const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const Comment = require('./models/Comment');
const app = express();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamicsite', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamicsite' })
}));

app.use((req, res, next) => {
  res.locals.currentUser = req.session.userId;
  next();
});

// Home page: show comments
app.get('/', async (req, res) => {
  const comments = await Comment.find().populate('user').sort({ createdAt: -1 });
  res.render('index', { comments });
});

// Registration
app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.render('register', { error: 'All fields required.' });
  const existing = await User.findOne({ username });
  if (existing) return res.render('register', { error: 'Username taken.' });
  const hash = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hash });
  await user.save();
  req.session.userId = user._id;
  res.redirect('/');
});

// Login
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.render('login', { error: 'Invalid credentials.' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.render('login', { error: 'Invalid credentials.' });
  req.session.userId = user._id;
  res.redirect('/');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Post a comment (must be logged in)
app.post('/comment', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const { text } = req.body;
  if (!text) return res.redirect('/');
  await Comment.create({ text, user: req.session.userId });
  res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
