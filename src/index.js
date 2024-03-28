import dotenv from "dotenv"
import mongoose from "mongoose";
import connectDB from "./db/connection.js";
import app from "./app.js";
dotenv.config({path:"./.env"})
connectDB()
.then(()=>{
    app.on("error",(err)=>{
        console.log("Failed to connect database with backend : "+err)
        throw err;
    })
    app.listen(process.env.PORT || 8000 , ()=>{
        console.log(`App is running on port ${process.env.PORT}`)
    })
})
.catch((err)=>{
    console.log("Failed to connect with database : "+err)
})