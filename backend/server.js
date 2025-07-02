// backend/server.js

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Create an instance of the Express app
const app = express();
const PORT = 3000; // The port our server will run on

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Allow the server to accept JSON data in requests

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB Atlas!'))
  .catch(err => console.error('MongoDB connection error:', err));

// Mongoose Schema and Model for the Profile
const ProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  lastUpdated: { type: Date, default: Date.now },
  questionnaire: { type: Array, default: [] },
  discovered: { type: Object, default: { interests: [], strengths: [], goals: [] } },
  // Add the new tracker object with default values
  tracker: {
    sat: {
      current: { type: Number, default: null },
      goal: { type: Number, default: null },
      targetDate: { type: String, default: '' }
    },
    gpa: {
      current: { type: Number, default: null },
      goal: { type: Number, default: null }
    },
    competitions: [{
        id: { type: String },
        name: { type: String },
        result: { type: String }
    }],
  },
}, { timestamps: true });

const Profile = mongoose.model('Profile', ProfileSchema);

const ALL_QUESTIONS = {
  collegeMatch: [
    {
      id: 'q1',
      question: 'What type of college are you looking for?', // Corrected key
      options: ['Public', 'Private', 'Community College', 'Online'],
    },
    {
      id: 'q2',
      question: 'What size of college are you looking for?', // Corrected key
      options: ['Small (under 5,000 students)', 'Medium (5,000 - 15,000 students)', 'Large (over 15,000 students)'],
    },
    {
      id: 'q3',
      question: 'What is your preferred location?', // Corrected key
      options: ['Urban', 'Suburban', 'Rural'],
    },
    {
      id: 'q4',
      question: 'What is your preferred region?', // Corrected key
      options: ['Northeast', 'Southeast', 'Midwest', 'West'],
    },
  ],
  academics: [
    {
      id: 'a1',
      question: 'What is your GPA (on a 4.0 scale)?', // Corrected key
      options: ['Below 3.0', '3.0 - 3.4', '3.5 - 3.7', '3.8 - 4.0'],
    },
    {
      id: 'a2',
      question: 'Have you taken any AP, IB, or Honors courses?', // Corrected key
      options: ['Yes, many', 'Yes, a few', 'No'],
    },
    {
      id: 'a3',
      question: 'What is your intended major or field of study?', // Corrected key
      options: ['STEM (Science, Tech, Engineering, Math)', 'Humanities', 'Arts', 'Business', 'Undecided'],
    },
  ],
  interests: [
    {
      id: 'i1',
      question: 'Which extracurricular activities are you involved in?', // Corrected key
      options: ['Sports', 'Music/Arts', 'Volunteering', 'Debate/Model UN', 'STEM Club'],
    },
    {
      id: 'i2',
      question: 'What do you enjoy doing in your free time?', // Corrected key
      options: ['Reading/Writing', 'Gaming', 'Coding/Building things', 'Spending time outdoors', 'Socializing'],
    },
    {
      id: 'i3',
      question: 'What kind of campus environment appeals to you?', // Corrected key
      options: ['A very social, spirited campus', 'A quiet, studious atmosphere', 'A politically active campus', 'A diverse, multicultural environment'],
    },
  ],
  financial: [
    {
      id: 'f1',
      question: 'Do you intend to apply for financial aid?', // Corrected key
      options: ['Yes', 'No', 'Unsure'],
    },
    {
      id: 'f2',
      question: 'What is your estimated annual household income?', // Corrected key
      options: ['Less than $50,000', '$50,000 - $100,000', '$100,000 - $150,000', 'More than $150,000'],
    },
    {
      id: 'f3',
      question: 'Are you interested in work-study programs?', // Corrected key
      options: ['Yes', 'No', 'Maybe'],
    },
  ],
};

// --- API Routes ---

// The NEW user creation route
app.post('/api/users/create', async (req, res) => {
  const { name, email, password, gradeLevel, school } = req.body; // 1. Get password from request

  if (!name || !email || !password) { // 2. Make password required
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  try {
    const existingProfile = await Profile.findOne({ userId: email });
    if (existingProfile) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    // 3. Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create the new profile with the hashed password
    const newProfile = new Profile({
      userId: email,
      name: name,
      password: hashedPassword, // Store the hashed password, not the original
    });

    await newProfile.save();

    res.status(201).json({
      message: 'User account and profile created successfully!',
      userId: newProfile.userId,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error while creating profile.', error });
  }
});

app.post('/api/users/signin', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Find the user by their email (which is their userId)
    const profile = await Profile.findOne({ userId: email });
    if (!profile) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Compare the provided password with the stored hashed password
    const isMatch = await bcrypt.compare(password, profile.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // If credentials are correct, send back a success message and the userId
    res.status(200).json({
      message: 'Sign in successful!',
      userId: profile.userId,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error during sign in.', error });
  }
});

// GET a user's profile
app.get('/api/profile/:userId', async (req, res) => {
  try {
    let profile = await Profile.findOne({ userId: req.params.userId });

    if (!profile) {
      // This case should rarely happen now, but it's good for robustness.
      console.log(`No profile found for ${req.params.userId}, creating a basic one.`);
      
      // We don't have the user's name or password here,
      // so we can only create a very basic profile.
      // The main user creation logic is now in the POST /api/users/create route.
      profile = new Profile({
        userId: req.params.userId,
        // We can't add name and password here as we don't know them.
        // This confirms that our main user creation logic is in the right place.
      });
      // await profile.save(); // It's better not to save a partial profile here.

      // Instead, we should indicate that no profile was found.
      return res.status(404).json({ message: "Profile not found." });
    }
    
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile', error });
  }
});

// UPDATE a user's profile
// In backend/server.js, replace the existing PUT route

app.put('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const newAnswerData = req.body.questionnaire; // e.g., { academics: { a1: "..." } }

    // 1. Find the user's current profile
    const profile = await Profile.findOne({ userId: userId });
    if (!profile) {
      return res.status(404).json({ message: "Profile not found." });
    }

    const category = Object.keys(newAnswerData)[0]; // "academics"
    const answers = newAnswerData[category]; // { a1: "..." }
    const questionsForCategory = ALL_QUESTIONS[category];

    // 2. Create the new, descriptive answer objects
    const formattedAnswers = Object.entries(answers).map(([questionId, answerText]) => {
      const question = questionsForCategory.find(q => q.id === questionId);
      return {
        id: questionId,
        category: category,
        question: question ? question.text : 'Unknown Question',
        answer: answerText,
      };
    });

    // 3. Filter out old answers from the same category to avoid duplicates
    const otherCategoryAnswers = profile.questionnaire.filter(q => q.category !== category);

    // 4. Combine old answers with the new ones
    profile.questionnaire = [...otherCategoryAnswers, ...formattedAnswers];
    profile.lastUpdated = Date.now();

    // 5. Save the updated profile
    await profile.save();

    res.json({ message: 'Profile updated successfully!', profile });
  } catch (error)
 {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Error updating profile', error });
  }
});

// NEW Route: Get answers formatted for the UI
app.get('/api/profile/:userId/answers', async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.params.userId });

    if (!profile) {
      return res.status(404).json({ message: "Profile not found." });
    }

    // Transform the descriptive array back into a simple object for the UI
    const answersForUI = {
      collegeMatch: {},
      academics: {},
      interests: {},
      financial: {},
    };

    profile.questionnaire.forEach(item => {
      if (answersForUI[item.category]) {
        answersForUI[item.category][item.id] = item.answer;
      }
    });

    res.json(answersForUI);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching formatted answers', error });
  }
});

app.get('/api/questions/collegematch', (req, res) => {
  res.json(ALL_QUESTIONS.collegeMatch || []);
});

app.get('/api/questions/academics', (req, res) => {
  res.json(ALL_QUESTIONS.academics || []);
});

app.get('/api/questions/interests', (req, res) => {
  res.json(ALL_QUESTIONS.interests || []);
});

app.get('/api/questions/financial', (req, res) => {
  res.json(ALL_QUESTIONS.financial || []);
});

// NEW Route: Analyze profile and generate a list of strengths
app.get('/api/profile/:userId/strengths', async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.params.userId });

    if (!profile) {
      return res.status(404).json({ message: "Profile not found." });
    }

    const strengths = [];
    const { academics, interests } = profile.questionnaire.reduce((acc, item) => {
        acc[item.category] = acc[item.category] || {};
        acc[item.category][item.id] = item.answer;
        return acc;
    }, {});


    // --- Simple Mock Logic for identifying strengths ---
    if (academics?.a1 === '3.8 - 4.0') {
      strengths.push({ id: 's1', text: 'High GPA', details: 'Your GPA is in the top tier, which is highly attractive to selective colleges.' });
    }
    if (academics?.a2 === 'Yes, many') {
      strengths.push({ id: 's2', text: 'Rigorous Course Load', details: 'Taking many AP, IB, or Honors courses shows you are prepared for college-level work.' });
    }
    if (interests?.i1 === 'Volunteering') {
      strengths.push({ id: 's3', text: 'Community Service', details: 'Your commitment to volunteering demonstrates strong character and community involvement.' });
    }
    if (interests?.i1 === 'Sports') {
        strengths.push({ id: 's4', text: 'Athletic Achievements', details: 'Participation in sports showcases teamwork, discipline, and dedication.' });
    }
    // Add more logic here as needed...

    res.json(strengths);

  } catch (error) {
    res.status(500).json({ message: 'Error generating strengths list', error });
  }
});

// NEW Route: Triggers an AI analysis of the user's profile
app.post('/api/profile/:userId/analyze/strengths', async (req, res) => {
  try {
    // 1. Fetch the user's full profile
    const profile = await Profile.findOne({ userId: req.params.userId });
    if (!profile) {
      return res.status(404).json({ message: "Profile not found." });
    }

    // 2. Format the profile data into a high-quality prompt
    let prompt = "Analyze the following student profile and identify their key strengths for college applications. List only the strengths.\n\n";
    prompt += `Student Name: ${profile.name}\n`;
    prompt += "--- Questionnaire Answers ---\n";
    profile.questionnaire.forEach(item => {
      prompt += `- ${item.question}: ${item.answer}\n`;
    });
    prompt += "\n--- Other Discovered Information ---\n";
    if (profile.discovered.interests.length > 0) {
      prompt += `- Interests: ${profile.discovered.interests.join(', ')}\n`;
    }

    console.log("---- Generated Prompt for AI ----\n", prompt);

    // 3. Call your Dify workflow (or any LLM API)
    //    Replace 'YOUR_DIFY_WORKFLOW_URL' and 'YOUR_DIFY_API_KEY' with your actual credentials.
    /*
    const difyResponse = await fetch('YOUR_DIFY_WORKFLOW_URL', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer YOUR_DIFY_API_KEY`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            inputs: { "prompt": prompt },
            response_mode: 'blocking',
            user: profile.userId
        })
    });
    const aiData = await difyResponse.json();
    const generatedStrengths = aiData.strengths; // Assuming Dify returns an object like { strengths: [...] }
    */

    // --- MOCK AI RESPONSE (for testing without a live Dify call) ---
    const generatedStrengths = [
        { id: 'ai_s1', text: 'Strong Academic Performer', details: 'A high GPA and rigorous coursework indicate strong academic capabilities.'},
        { id: 'ai_s2', text: 'Community-Oriented', details: 'Involvement in volunteering shows a commitment to community impact.'},
        { id: 'ai_s3', text: 'Creative Thinker', details: 'An interest in the Arts suggests creativity and a unique perspective.'},
    ];
    // --- END OF MOCK ---

    // 4. Update the profile in the database with the new AI-generated strengths
    profile.discovered.strengths = generatedStrengths.map(s => s.text); // Save just the text for future analysis
    await profile.save();

    // 5. Send the detailed strengths list back to the frontend
    res.json(generatedStrengths);

  } catch (error) {
    console.error("AI Analysis Error:", error);
    res.status(500).json({ message: 'Error during AI analysis', error });
  }
});

// Start the server and listen for incoming requests
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});