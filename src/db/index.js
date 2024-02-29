import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";


const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`mongodb+srv://hasnainshaikh62479:hasnainshaikh62479@cluster0.2su9nuf.mongodb.net/${DB_NAME}`)
        console.log(`\n MongoDB connected !! DB HOST: ytproject`);
    } catch (error) {
        console.log("MONGODB connection FAILED ", error);
        process.exit(1)
    }
}

export default connectDB