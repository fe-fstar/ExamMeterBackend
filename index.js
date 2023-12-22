const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 4444;

app.use(express.json());
app.use(cors());

app.get("/healthcheck", (_, res) => {
    const data = {
        uptime: process.uptime(),
        message: "OK",
        date: new Date()
    }
    res.status(200).send(data);
});

app.use("/api", require("./routes/home-routes"));

app.listen(PORT, (error) => {
    if (!error)
        console.log(`App listening on PORT: ${PORT}`);
    else
        console.log("Error occurred, server can't start: ", error);
});