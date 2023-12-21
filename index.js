const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 4444;

app.use(express.json());
app.use(cors());

app.use("/api", require("./routes/home-routes"));

app.listen(PORT, (error) => {
    if (!error)
        console.log(`App listening on PORT: ${PORT}`);
    else
        console.log("Error occurred, server can't start: ", error);
}
);