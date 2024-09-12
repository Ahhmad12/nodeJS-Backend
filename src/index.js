import dotenv from "dotenv";
import express from "express";
import connectDB from "./db/index.js";

const app = express();
dotenv.config({
  path: "./env",
});

connectDB()
  .then(() => {
    app.on("error", (error) => {
      console.log("ERROR: ", error);
    });
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server is running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.log(`MongoDb connection is failed !!! ${err}`);
  });
