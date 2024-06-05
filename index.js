require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const SignUp = require('./config.js');
const passportConfig = require('./passport-config.js');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const request = require('request');
const app = express();

passportConfig(passport);

app.use(express.json());
app.use(cors({
  origin: 'https://quoterandom.onrender.com', 
  credentials: true 
}));
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.get("/", (req, res) => {
  res.send("hello world");
});

app.post("/signup", async (req, res) => {
  try {
    const sign = new SignUp(req.body);
    const result = await sign.save();
    res.status(201).json(result);
  } catch (error) {
    res.status(500).send(error);
    console.error(error);
  }
});

app.post("/login", (req, res, next) => {
  passport.authenticate('local', async (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(400).json({ message: info.message });
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.status(200).json({ message: 'Login successful', userId: user._id });
    });
  })(req, res, next);
});

app.post("/niche", async (req, res) => {
  const { keyIndex, loginUserId } = req.body;
  try {
    const user = await SignUp.findById(loginUserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.niches = [keyIndex];
    await user.save();
    res.status(200).json({ message: 'Niche added successfully' });
  } catch (error) {
    res.status(500).send(error);
    console.error(error);
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); 
    return res.json({ message: 'Logout successful' });
  });
});


cron.schedule('0 5 * * * *', async () => {
  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.APP_KEY,
      },
    });

    const users = await SignUp.find({}); 
    const emailTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Quote</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);">
        <div style="background-color: #007bff; color: #ffffff; padding: 20px; text-align: center;">
          <h1>Daily Quote</h1>
        </div>
        <div style="padding: 20px;">
          <p style="font-size: 18px;">Hello,</p>
          <p style="font-size: 16px;">Here is your daily inspirational quote:</p>
          <blockquote style="font-size: 20px; margin: 20px 0; border-left: 5px solid #007bff; padding-left: 10px;">{quote}</blockquote>
          <p style="font-size: 16px;">Have a great day!</p>
        </div>
        <div style="background-color: #007bff; color: #ffffff; padding: 10px; text-align: center;">
          <p style="font-size: 14px; margin: 0;">Sent by Gaurav</p>
        </div>
      </div>
    </body>
    </html>
    `;
    
    users.forEach(async user => {
      const niche = user.niches[0]; 
      const quote = await getQuoteFromApi(niche);
      const formattedTemplate = emailTemplate.replace('{quote}', quote);
      const mailOptions = {
        from: process.env.EMAIL,
        to: user.email,
        subject: 'Your Daily Quote',
        html: formattedTemplate
      };

      transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
          console.error('Error sending email:', error);
        } else {
          console.log('Email sent:', info.response);
        }
      });
    });
  } catch (error) {
    console.error('Error scheduling task:', error);
  }
});

const getQuoteFromApi = async (category) => {
  return new Promise((resolve, reject) => {
    request.get({
      url: 'https://api.api-ninjas.com/v1/quotes?category=' + category,
      headers: {
        'X-Api-Key': 'xRNLgqyiF1n1ewAt6kv7QA==TkaxrAt6xpmM3B2E'
      },
    }, function(error, response, body) {
      if (error) {
        reject(error);
      } else if (response.statusCode != 200) {
        reject('Error: ' + response.statusCode);
      } else {
        const quoteData = JSON.parse(body);
        if (quoteData.length > 0) {
          resolve(quoteData[0].quote);
        } else {
          reject('No quotes found for the specified category');
        }
      }
    });
  });
};



app.listen(5000, () => {
  console.log("Server started on port 5000");
});
