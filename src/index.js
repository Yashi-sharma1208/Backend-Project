import dotenv from "dotenv"
import mongoose from "mongoose";
import connectDB from "./db/connection.js";
dotenv.config({path:"./env"})
connectDB();