const express = require('express')
const router = express.Router()

// In-memory community posts store
// Post: { id, author, text, mediaUrl, mediaType: 'image'|'video'|null, lang, createdAt, likes: number, comments: [{ id, author, text, createdAt }], featured: boolean }
let POSTS = [
  {
    id: 'p1',
    author: 'Devotee A',
    text: 'Blessed visit to Somnath during Kartik Purnima. Divine vibrations everywhere! 🙏',
    mediaUrl: '',
    mediaType: null,
    lang: 'en',
    createdAt: new Date().toISOString(),
    likes: 3,
    comments: [{ id: 'c1', author: 'Seeker', text: 'Jai Somnath!', createdAt: new Date().toISOString() }],
    featured: true,
  },
]

function nextId(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 8)}` }

// GET /api/community/posts?lang=en&sort=top
router.get('/posts', (req, res) => {
  const { lang, sort } = req.query
  let list = [...POSTS]
  if (lang && lang !== 'all') list = list.filter(p => (p.lang || 'en') === lang)
  if (sort === 'top') list.sort((a,b) => (b.likes||0) - (a.likes||0))
  else list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
  res.json({ data: { posts: list } })
})

// POST /api/community/posts
router.post('/posts', (req, res) => {
  const { author = 'Anonymous', text = '', mediaUrl = '', mediaType = null, lang = 'en' } = req.body || {}
  if (!text && !mediaUrl) return res.status(400).json({ message: 'Provide text or mediaUrl' })
  const post = {
    id: nextId('post'),
    author: String(author).slice(0, 60) || 'Anonymous',
    text: String(text).slice(0, 2000),
    mediaUrl: String(mediaUrl || ''),
    mediaType: mediaType === 'video' ? 'video' : (mediaUrl ? 'image' : null),
    lang: String(lang || 'en'),
    createdAt: new Date().toISOString(),
    likes: 0,
    comments: [],
    featured: false,
  }
  POSTS.unshift(post)
  res.status(201).json({ data: { post } })
})

// POST /api/community/posts/:id/like
router.post('/posts/:id/like', (req, res) => {
  const post = POSTS.find(p => p.id === req.params.id)
  if (!post) return res.status(404).json({ message: 'Post not found' })
  post.likes = (post.likes || 0) + 1
  res.json({ data: { likes: post.likes } })
})

// POST /api/community/posts/:id/comment
router.post('/posts/:id/comment', (req, res) => {
  const post = POSTS.find(p => p.id === req.params.id)
  if (!post) return res.status(404).json({ message: 'Post not found' })
  const { author = 'Anonymous', text = '' } = req.body || {}
  if (!text) return res.status(400).json({ message: 'Comment text is required' })
  const comment = { id: nextId('c'), author: String(author).slice(0,60) || 'Anonymous', text: String(text).slice(0,1000), createdAt: new Date().toISOString() }
  post.comments = post.comments || []
  post.comments.push(comment)
  res.status(201).json({ data: { comment } })
})

// DELETE /api/community/posts/:id  (simple moderation)
router.delete('/posts/:id', (req, res) => {
  const { id } = req.params
  const before = POSTS.length
  POSTS = POSTS.filter(p => p.id !== id)
  if (POSTS.length === before) return res.status(404).json({ message: 'Post not found' })
  res.json({ message: 'Deleted' })
})

module.exports = router
