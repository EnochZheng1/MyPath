// backend/server.js

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { callDifyWorkflow } = require('./difyService');
const { generateProfileSummary, ALL_QUESTIONS } = require('./utils/profileUtils');
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
  collegeList: {
      reach: { type: Array, default: [] },
      target: { type: Array, default: [] },
      likely: { type: Array, default: [] },
      lastGenerated: { type: Date }
  },
  profileSummary: { type: String, default: '' }
}, { timestamps: true });

const Profile = mongoose.model('Profile', ProfileSchema);

// --- API Routes ---

// The NEW user creation route
app.post('/api/users/create', async (req, res) => {
  console.log('--- Received request to POST /api/users/create ---');
  const { name, email, password, gradeLevel, school } = req.body; // 1. Get password from request
  if (!name || !email || !password) { // 2. Make password required
    console.log('[FAIL] Missing name, email, or password.');
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  try {
    const existingProfile = await Profile.findOne({ userId: email });
    if (existingProfile) {
      console.log(`[FAIL] User with email ${email} already exists.`);
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
    console.log(`[SUCCESS] New profile created for userId: ${newProfile.userId}`);

    res.status(201).json({
      message: 'User account and profile created successfully!',
      userId: newProfile.userId,
    });

  } catch (error) {
    console.error('[ERROR] Server error during profile creation:', error);
    res.status(500).json({ message: 'Server error while creating profile.', error });
  }
});

app.post('/api/users/signin', async (req, res) => {
  console.log('--- Received request to POST /api/users/signin ---');
  const { email, password } = req.body;

  if (!email || !password) {
    console.log('[FAIL] Missing email or password.');
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Find the user by their email (which is their userId)
    const profile = await Profile.findOne({ userId: email });
    if (!profile) {
      console.log(`[FAIL] Sign-in failed. User not found: ${email}`);
      return res.status(404).json({ message: 'User not found.' });
    }

    // Compare the provided password with the stored hashed password
    const isMatch = await bcrypt.compare(password, profile.password);
    if (!isMatch) {
      console.log(`[FAIL] Sign-in failed. Invalid credentials for: ${email}`);
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // If credentials are correct, send back a success message and the userId
    console.log(`[SUCCESS] User signed in: ${profile.userId}`);
    res.status(200).json({
      message: 'Sign in successful!',
      userId: profile.userId,
    });

  } catch (error) {
    console.error('[ERROR] Server error during sign in:', error);
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
// In backend/server.js, replace your existing PUT '/api/profile/:userId' route with this one

app.put('/api/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  console.log(`--- Received request to PUT /api/profile/${userId} ---`);
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  try {
    const profile = await Profile.findOne({ userId: userId });
    if (!profile) {
      console.log(`[FAIL] Profile not found for userId: ${userId}`);
      return res.status(404).json({ message: "Profile not found." });
    }

    const updates = req.body;

    // --- Update Logic ---

    // 1. Update questionnaire answers if they are in the request body
    if (updates.questionnaire) {
      const category = Object.keys(updates.questionnaire)[0];
      const answers = updates.questionnaire[category];
      const questionsForCategory = ALL_QUESTIONS[category];

      if (questionsForCategory) {
        const formattedAnswers = Object.entries(answers).map(([questionId, answerText]) => {
          const question = questionsForCategory.find(q => q.id === questionId);
          return {
            id: questionId,
            category: category,
            question: question ? question.question : 'Unknown Question',
            answer: answerText,
          };
        });

        const otherCategoryAnswers = profile.questionnaire.filter(q => q.category !== category);
        profile.questionnaire = [...otherCategoryAnswers, ...formattedAnswers];
      }
    }
    
    // 2. Update tracker data if it is in the request body
    if (updates.tracker) {
        // This will merge the new tracker data (e.g., just the 'sat' part)
        // with the existing tracker data without overwriting other parts.
        profile.tracker = { ...profile.tracker, ...updates.tracker };
    }

    // 3. Re-generate and save the profile summary after all updates
    profile.profileSummary = await generateProfileSummary(profile);
    console.log(`Generated profile summary: {${profile.profileSummary}}`)
    profile.lastUpdated = Date.now();
    
    // 4. Save all changes to the database
    await profile.save();

    console.log(`[SUCCESS] Profile updated and summary regenerated for userId: ${userId}`);
    res.json({ message: 'Profile updated successfully!', profile });

  } catch (error) {
    console.error(`[ERROR] Error updating profile for ${userId}:`, error);
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

// Add this new route to your backend/server.js file

app.get('/api/profile/:userId/improvements', async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.params.userId });

    if (!profile) {
      return res.status(404).json({ message: "Profile not found." });
    }

    const improvements = [];
    
    // Create a simple object from the questionnaire array for easier access
    const answers = profile.questionnaire.reduce((acc, item) => {
      acc[item.id] = item.answer;
      return acc;
    }, {});


    // --- Simple Mock Logic for identifying areas for improvement ---
    
    // Academic Improvements
    if (answers['a1'] === 'Below 3.0' || answers['a1'] === '3.0 - 3.4') {
      improvements.push({ 
        id: 'i1', 
        text: 'Boost Your GPA', 
        details: 'Focus on study habits and seek extra help to raise your GPA, as this is a key factor for admissions.' 
      });
    }
    if (answers['a2'] === 'No') {
      improvements.push({ 
        id: 'i2', 
        text: 'Consider Advanced Courses', 
        details: 'Taking AP, IB, or Honors courses can strengthen your application. See if any are available at your school.' 
      });
    }

    // Interest-based Improvements
    if (answers['i1'] !== 'Volunteering') {
        improvements.push({ 
            id: 'i3', 
            text: 'Explore Community Service', 
            details: 'Volunteering can demonstrate character and a commitment to your community. Look for local opportunities.' 
        });
    }
    
    // Add more logic here as your app evolves...

    res.json(improvements);

  } catch (error) {
    res.status(500).json({ message: 'Error generating improvements list', error });
  }
});

app.post('/api/colleges/generate', async (req, res) => {
  const { userId } = req.body;
  console.log(`--- Received request to POST /api/colleges/generate for userId: ${userId} ---`);
  if (!userId) {
    console.log('[FAIL] User ID was not provided in the request body.');
    return res.status(400).json({ message: 'User ID is required.' });
  }

  try {
    // 1. Fetch the user's full profile from the database
    console.log(`[INFO] Fetching profile for userId: ${userId}...`);
    const profile = await Profile.findOne({ userId: userId });
    if (!profile) {
      console.log(`[FAIL] Profile not found for userId: ${userId}.`);
      return res.status(404).json({ message: "Profile not found." });
    }
    console.log('[SUCCESS] Profile fetched successfully.');
    
    let profileSummary;
    
    // 2. Check if a summary already exists and is not empty.
    if (profile.profileSummary && profile.profileSummary.trim() !== '') {
      console.log('[INFO] Using existing profile summary from database.');
      profileSummary = profile.profileSummary;
    } else {
      // 3. If no summary exists, generate one now.
      console.log('[INFO] No summary found. Generating a new AI profile summary...');
      profileSummary = await generateProfileSummary(profile);
      
      // 4. Save the newly generated summary back to the profile for future use.
      profile.profileSummary = profileSummary;
      await profile.save();
      console.log(`[SUCCESS] New summary generated and saved for user: ${userId}`);
    }
    
    console.log("---- Using Profile Summary for Dify ----\n", profileSummary);

    // 3. Construct the body for the Dify workflow
    const difyBody = {
        inputs: {
            "profile": profileSummary 
        },
        response_mode: 'blocking',
        user: process.env.DIFY_USER
    };

    // 4. Call the Dify service (remains the same)
    console.log('[INFO] Sending request to Dify workflow...');
    console.log("--- DEBUGGING DIFY CREDENTIALS ---");
    console.log("Workflow URL being used:", process.env.DIFY_WORKFLOW_URL);
    console.log("API Key being used:", process.env.COLLEGE_LIST_KEY ? "Loaded (hidden for security)" : "NOT LOADED");
    console.log("------------------------------------");
    const aiData = await callDifyWorkflow(
        process.env.DIFY_WORKFLOW_URL,
        process.env.COLLEGE_LIST_KEY,
        difyBody
    );
    console.log('[SUCCESS] Received response from Dify.');

    // 5. Parse the JSON string from Dify's response and send it back
    console.log('[INFO] Parsing college list from Dify response...');
    const collegeListString = aiData.data.outputs.CollegeList;
    const allColleges = JSON.parse(collegeListString);
    const allCollegesWithReasons = allColleges.map(c => ({ ...c, reasons: [] }));
    const categorizedList = {
      reach: allCollegesWithReasons.filter(c => c.category === 'Reach' || c.category === 'reach'),
      target: allCollegesWithReasons.filter(c => c.category === 'Target' || c.category === 'target'),
      likely: allCollegesWithReasons.filter(c => c.category === 'Safety' || c.category === 'likely'),
    };
    profile.collegeList = {
        ...categorizedList,
        lastGenerated: new Date()
    };
    await profile.save();
    console.log(`[SUCCESS] Sending categorized college list to user: ${userId}`);
    res.json(categorizedList);

  } catch (error) {
    console.error("[ERROR] College List Generation Failed:", error.message);
    res.status(500).json({ message: 'Error generating college list.' });
  }
});

app.post('/api/colleges/why', async (req, res) => {
  const { userId, schoolName } = req.body;
  if (!userId || !schoolName) {
    return res.status(400).json({ message: 'User ID and school name are required.' });
  }

  try {
    const profile = await Profile.findOne({ userId: userId });
    if (!profile) {
      return res.status(404).json({ message: "Profile not found." });
    }

    // --- NEW: Check if reasons already exist ---
    let collegeToUpdate;
    for (const category of ['reach', 'target', 'likely']) {
        collegeToUpdate = profile.collegeList[category]?.find(c => c.school === schoolName);
        if (collegeToUpdate) break;
    }

    if (collegeToUpdate && collegeToUpdate.reasons && collegeToUpdate.reasons.length > 0) {
        console.log(`[INFO] Returning saved 'Why' reasons for ${schoolName}`);
        return res.json(collegeToUpdate.reasons);
    }
    // --- END OF NEW LOGIC ---

    console.log(`[INFO] No saved reasons found. Generating new 'Why' reasons for ${schoolName}`);
    const difyBody = { /* ... as before ... */ };

    const aiData = await callDifyWorkflow(
        process.env.DIFY_WORKFLOW_URL,
        process.env.COLLEGE_WHY_KEY,
        difyBody
    );
    
    const reasons = aiData.response;

    // --- NEW: Save the new reasons to the database ---
    if (collegeToUpdate) {
        collegeToUpdate.reasons = reasons;
        profile.markModified('collegeList');
        await profile.save();
        console.log(`[SUCCESS] Saved new 'Why' reasons for ${schoolName}`);
    }

    res.json(reasons);

  } catch (error) {
    console.error("Error in 'Why' endpoint:", error.message);
    res.status(500).json({ message: 'Error generating reasons for recommendation.' });
  }
});

// Start the server and listen for incoming requests
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});