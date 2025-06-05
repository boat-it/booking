const http = require('http');
const WebSocket = require('ws');
const express = require('express');

const router = express.Router();
// ✅ ใช้ express เพื่อเสิร์ฟ static files
const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

// ✅ รองรับ WebSocket เฉพาะที่ path /meeting-ws
// const wss = new WebSocket.Server({ server, path: '/meeting-ws' });

let bookings = [];

wss.on('connection', function connection(ws) {
    // ส่งข้อมูลทั้งหมดให้ client ที่เพิ่งเชื่อมต่อ
    ws.send(JSON.stringify({ type: 'init', bookings }));

    ws.on('message', function incoming(message) {
        const data = JSON.parse(message);

        if (data.type === 'book') {
            const id = Date.now();
            const { room, start, end, note, booker } = data;

            const newBooking = { id, room, start, end, note, booker };
            bookings.push(newBooking);

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'booked', booking: newBooking }));
                }
            });
        }

        if (data.type === 'cancel') {
            bookings = bookings.filter(b => b.id !== data.id);

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'cancelled', id: data.id }));
                }
            });
        }

        if (data.type === 'clear_all') {
            bookings = [];

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'init', bookings: [] }));
                }
            });
        }
    });
});

// ✅ เสิร์ฟ static page ที่ path /meeting
app.use('/meeting', express.static('public'));

router.get('/GG', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

server.listen(3000, () => {
    console.log('✅ Server is running at http://localhost:3000');
});
