const axios = require('axios');
const RSSParser = require('rss-parser');
const cheerio = require('cheerio');
const Slot = require('../../models/Slot');

// Simple in-memory cache with TTL per temple
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const cache = new Map(); // key: templeId, value: { data, expiry }

const rssParser = new RSSParser({ timeout: 10000 });

async function safeGet(url, options = {}) {
  if (!url) return null;
  try {
    const res = await axios.get(url, { timeout: 10000, ...options });
    return res.data;
  } catch (_) {
    return null;
  }
}

async function fetchRSSItems(feeds = []) {
  const items = [];
  for (const feed of feeds) {
    try {
      const parsed = await rssParser.parseURL(feed);
      if (parsed?.items?.length) {
        items.push(
          ...parsed.items.slice(0, 5).map((it) => ({
            title: it.title,
            link: it.link,
            pubDate: it.pubDate || it.isoDate,
            source: parsed.title || feed,
          }))
        );
      }
    } catch (_) {
      // Ignore RSS errors for resilience
    }
  }
  // Sort by date desc
  return items.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0)).slice(0, 10);
}

// Basic website parsing stub. Each temple website is unique.
// For MVP, we try to extract any visible timing hints and announcements sections where obvious.
async function scrapeWebsiteForHints(websiteUrl) {
  const html = await safeGet(websiteUrl, { responseType: 'text' });
  if (!html) return { hints: {}, notices: [] };

  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ').toLowerCase();

  const hints = {};
  if (text.includes('darshan') && (text.includes('time') || text.includes('timing'))) {
    hints.darshanMentioned = true;
  }
  if (text.includes('aarti') || text.includes('arati')) {
    hints.aartiMentioned = true;
  }

  // Try to pick obvious notices section links
  const notices = [];
  $('a').each((_, a) => {
    const href = $(a).attr('href') || '';
    const label = $(a).text().trim();
    const l = label.toLowerCase();
    if (l.includes('notice') || l.includes('announcement') || l.includes('news')) {
      notices.push({ title: label || 'Notice', link: href.startsWith('http') ? href : new URL(href, websiteUrl).href });
    }
  });

  return { hints, notices: notices.slice(0, 5) };
}

function buildMapsLink(coords) {
  if (!coords?.latitude || !coords?.longitude) return null;
  return `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
}

async function computeSlotAvailability(templeId) {
  try {
    const todayISO = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(`${todayISO}T00:00:00.000Z`);
    const endOfDay = new Date(`${todayISO}T23:59:59.999Z`);

    // Fetch next few upcoming slots today
    const now = new Date();
    const slots = await Slot.find({
      temple: templeId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['available', 'full'] },
      isActive: true,
    })
      .sort({ date: 1, startTime: 1 })
      .limit(10);

    if (!slots || slots.length === 0) {
      return { status: 'unknown', remaining: null };
    }

    // Consider only future slots
    const futureSlots = slots.filter((s) => new Date(`${s.date.toISOString().split('T')[0]}T${s.startTime}:00Z`) > now);
    const considered = futureSlots.length ? futureSlots : slots;

    let availableCount = 0;
    let remainingSpots = 0;
    for (const s of considered) {
      const rem = Math.max(0, s.capacity - (s.bookedCount || 0));
      if (s.status === 'available' && rem > 0) {
        availableCount++;
        remainingSpots += rem;
      }
    }

    if (availableCount === 0) return { status: 'full', remaining: 0 };
    if (availableCount <= Math.ceil(considered.length * 0.3)) return { status: 'limited', remaining: remainingSpots };
    return { status: 'available', remaining: remainingSpots };
  } catch (_) {
    return { status: 'unknown', remaining: null };
  }
}

function normalizeTimings(timings) {
  if (!timings) return null;
  return {
    openTime: timings.openTime,
    closeTime: timings.closeTime,
    breakTime: Array.isArray(timings.breakTime) ? timings.breakTime : [],
  };
}

async function getRealtimeInfo(temple) {
  const key = String(temple._id);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiry > now) {
    return cached.data;
  }

  const websiteUrl = temple.externalSources?.websiteUrl || null;
  const rssFeeds = Array.isArray(temple.externalSources?.rssFeeds) ? temple.externalSources.rssFeeds : [];

  // Parallel fetch: RSS and basic website hints
  const [rssItems, websiteHints] = await Promise.all([
    fetchRSSItems(rssFeeds),
    scrapeWebsiteForHints(websiteUrl),
  ]);

  const data = {
    templeId: key,
    templeName: temple.name,
    basicInfo: {
      address: temple.location?.address || null,
      city: temple.location?.city || null,
      state: temple.location?.state || null,
      websiteUrl,
      googleMapsUrl: buildMapsLink(temple.location?.coordinates),
    },
    darshanTimings: normalizeTimings(temple.timings),
    slotAvailability: await computeSlotAvailability(temple._id),
    crowd: {
      isOpen: !!temple.currentStatus?.isOpen,
      currentOccupancy: temple.currentStatus?.currentOccupancy ?? null,
      occupancyPercentage: typeof temple.occupancyPercentage === 'number' ? temple.occupancyPercentage : null,
      crowdLevel: typeof temple.getCrowdLevel === 'function' ? temple.getCrowdLevel() : null,
      lastUpdated: temple.currentStatus?.lastUpdated || null,
    },
    notices: [
      ...rssItems,
      ...(websiteHints?.notices || []),
    ],
    hints: websiteHints?.hints || {},
    fetchedAt: new Date().toISOString(),
  };

  cache.set(key, { data, expiry: now + CACHE_TTL_MS });
  return data;
}

module.exports = { getRealtimeInfo };
