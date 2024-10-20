import otpGenerator from 'otp-generator';
import { Otp } from '../models/Otp.model';
import { User } from '../models/User.model';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { oauth2Client } from '../config/googleConfig';


const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    path: '/'
}

const sendOtp = async (req, res) => {
    try {
        const { email } = req.body;
        const otp = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false
        }).toString();
        const otpModel = await Otp.create({ email, otp });
        console.log(otpModel);
        return res.status(200).json({
            success: true,
            message: 'OTP sent successfully' 
        });
    } catch (error) {
        console.log("Error in sendOtp: ", error);
    }
}

const emailSignup = async (req, res) => {
    try {
        const { firstName, lastName, email, password, otp } = req.body;
        if(!firstName || !lastName || !email || !password || !otp) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        const existingUser = await User.findOne({ email });
        if(existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        const recentOtp = await Otp.find({ email }).sort({ createdAt: -1 }).limit(1);
        if(recentOtp.length == 0) {
            return res.status(400).json({
                success: false,
                message: "OTP not found"
            });
        }
        else if(recentOtp[0].otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({ firstName, lastName, email, password: hashedPassword });
        user.password = undefined;

        const payload = {
            email: user.email,
            id: user._id,
        }

        const token = jwt.sign(payload, process.env.JWT_SECRET);
        
        return res.cookie("token", token, cookieOptions).status(201).json({
            success: true,
            message: 'User created successfully',
            user
        });
    } catch (error) {
        console.log("Error in emailSignup: ", error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

const emailLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if(!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }
        const user = await User.findOne({ email });
        if(!user) {
            return res.status(400).json({
                success: false,
                message: 'User not found'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password'
            });
        }

        const payload = {
            email: user.email,
            id: user._id,
        }
        const token = jwt.sign(payload, process.env.JWT_SECRET);

        user.password = undefined;
        return res.cookie("token", token, cookieOptions).status(200).json({
            success: true,
            message: 'User logged in successfully',
            user
        });
    } catch (error) {
        console.log("Error in emailLogin: ", error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

const googleSignup = async (req, res) => {
    try {
        const code = req.query.code;
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        const response = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${tokens.access_token}`);
        const data = await response.json();
        console.log(data);
    } catch (error) {
        console.log("Error in googleSignup: ", error);
    }
}

const logout = async (req, res) => {
    try {
        res.clearCookie("token", cookieOptions)
        return res.status(200).json({
            success: true,
            message: 'User logged out successfully'
        });
    } catch (error) {
        console.log("Error in logout: ", error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}