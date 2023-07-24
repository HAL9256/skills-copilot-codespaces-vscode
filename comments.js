// Create web server
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const {randomBytes} = require('crypto');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Comments are stored in memory
const commentsByPostId = {};

// Return all comments for a given post
app.get('/posts/:id/comments', (req, res) => {
    res.send(commentsByPostId[req.params.id] || []);
});

// Create a new comment
app.post('/posts/:id/comments', async (req, res) => {
    const commentId = randomBytes(4).toString('hex');
    const {content} = req.body;

    // Fetch all comments for this post
    const comments = commentsByPostId[req.params.id] || [];

    // Add new comment
    comments.push({id: commentId, content, status: 'pending'});

    // Store comments
    commentsByPostId[req.params.id] = comments;

    // Send event to event bus
    await axios.post('http://event-bus-srv:4005/events', {
        type: 'CommentCreated',
        data: {
            id: commentId,
            content,
            postId: req.params.id,
            status: 'pending'
        }
    });

    res.status(201).send(comments);
});

// Receive events from event bus
app.post('/events', async (req, res) => {
    console.log('Event Received:', req.body.type);

    const {type, data} = req.body;

    if (type === 'CommentModerated') {
        const {postId, id, status, content} = data;

        // Fetch all comments for this post
        const comments = commentsByPostId[postId];

        // Find comment and update status
        const comment = comments.find(comment => {
            return comment.id === id;
        });

        comment.status = status;

        // Send event to event bus
        await axios.post('http://event-bus-srv:4005/events', {
            type: 'CommentUpdated',
            data: {
                id,
                postId,
                status,
                content
            }
        });
    }

    res.send({});
});

app.listen(4001, () => {
    console.log('Listening on 4001');
});