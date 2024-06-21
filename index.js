const express = require('express')
const app = express()
const port = 5000
const mongoDb = require("./db")
const cors = require('cors');

app.use(cors());

mongoDb();

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.use(express.json())
app.use('/api', require('./routes/CrtUser'));
app.use('/api', require('./routes/CrtPMsg'));
app.use('/api', require('./routes/DisplayData'));
app.use('/api', require('./routes/HandleChats'));

const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});

const io = require("socket.io")(server, {
  pingTimeout: 15000,
  cors: {
    origin: "https://pool-pal.vercel.app/"
  },
});

io.on("connection", (socket) => {

  socket.on("get-chatroom", async chatid => {

    socket.join(chatid);

    socket.on("new message", (newMessageRecieved) => {
      socket.broadcast.to(chatid).emit("message recieved", newMessageRecieved);
    });

    socket.on("update-status", (basket) => {
      socket.broadcast.to(basket.chatId).emit("status recieved", basket);
    });
  });

});