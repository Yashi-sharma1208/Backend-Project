import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
const registerUser = asyncHandler (async (req,res)=>{
    // Alogorithm for registration Process
    // 1). Take Input from frontend
    // 2). Apply validations
    // 3). Check whether user already exists or not
    // 4). If everything is fine then proceed for images-- upload images on local path
    // 5). Upload Images on cloudinary -- check for avatar
    // 6). Get the url of images from cloudinary-- check for avatar
    // 7). insert data into database
    // 8). Remove password and refresh token from database response
    // 9). Return response

    // Taken input from frontend
    const {email,username,password,fullName} = req.body
    // Making sure that all required fields are not empty
    if(
        [email,username,password,fullName].some((field)=> field?.trim()==="")
    ){
        throw new ApiError(400,"All fields are required")
    }
    // Check whether user already exists or not
    const isUserExist = await User.findOne({
        $or:[{username},{email}]
    })
    if(isUserExist){
        throw new ApiError(409,"User already exists")
    }
    // Uploading files on cloudinary
    console.log("Files = ",req.files)
    let avatarLocalPath;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.avatar) && req.files.avatar.length>0){
        avatarLocalPath = req.files.avatar[0].path
    }
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath = req.files.coverImage[0].path
    }
    // If avatar doesn't exist then return an error
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new ApiError(400,"Failed to upload avatar on cloudinary")
    }
    const user = await User.create({
        username: username.toLowerCase(),
        password,
        email,
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })
    const createdUser = await User.findById(user._id).select("-password -refreshToken")
    if(!createdUser){
        throw new ApiError(500,"Failed to insert data into database")
    }
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User has been registered successfully")
    )
})
export {registerUser}