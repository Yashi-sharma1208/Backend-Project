import {v2 as cloudinary} from "cloudinary"
import fs from "fs"
          
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary = async (localFilepath) =>{
  try{
    // uploading file on cloudinary
    if(!localFilepath) return null;
    const response = await cloudinary.uploader.upload(localFilepath,{
      resource_type:"auto"
    })
    // File has been uploaded successfully
    console.log("File has been uploaded successfully on cloudinary ", response.url)
    fs.unlinkSync(localFilepath) 
    return response;
  }
  catch(error){
    fs.unlinkSync(localFilepath) // Remove the locally saved temprary file as the upload operation is failed 
    return null
  }
}
export {uploadOnCloudinary}