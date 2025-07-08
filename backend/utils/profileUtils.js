// backend/utils/profileUtils.js

const { callDifyWorkflow } = require('../difyService');

const ALL_QUESTIONS = {
  collegeMatch: [
    { id: 'q1', question: 'What type of college are you looking for?', options: ['Public', 'Private', 'Community College', 'Online'] },
    { id: 'q2', question: 'What size of college are you looking for?', options: ['Small (under 5,000 students)', 'Medium (5,000 - 15,000 students)', 'Large (over 15,000 students)'] },
    { id: 'q3', question: 'What is your preferred location?', options: ['Urban', 'Suburban', 'Rural'] },
    { id: 'q4', question: 'What is your preferred region?', options: ['Northeast', 'Southeast', 'Midwest', 'West'] },
  ],
  academics: [
    { id: 'a1', question: 'What is your GPA (on a 4.0 scale)?', options: ['Below 3.0', '3.0 - 3.4', '3.5 - 3.7', '3.8 - 4.0'] },
    { id: 'a2', question: 'Have you taken any AP, IB, or Honors courses?', options: ['Yes, many', 'Yes, a few', 'No'] },
    { id: 'a3', question: 'What is your intended major or field of study?', options: ['STEM (Science, Tech, Engineering, Math)', 'Humanities', 'Arts', 'Business', 'Undecided'] },
  ],
  interests: [
    { id: 'i1', question: 'Which extracurricular activities are you involved in?', options: ['Sports', 'Music/Arts', 'Volunteering', 'Debate/Model UN', 'STEM Club'] },
    { id: 'i2', question: 'What do you enjoy doing in your free time?', options: ['Reading/Writing', 'Gaming', 'Coding/Building things', 'Spending time outdoors', 'Socializing'] },
    { id: 'i3', question: 'What kind of campus environment appeals to you?', options: ['A very social, spirited campus', 'A quiet, studious atmosphere', 'A politically active campus', 'A diverse, multicultural environment'] },
  ],
  financial: [
    { id: 'f1', question: 'Do you intend to apply for financial aid?', options: ['Yes', 'No', 'Unsure'] },
    { id: 'f2', question: 'What is your estimated annual household income?', options: ['Less than $50,000', '$50,000 - $100,000', '$100,000 - $150,000', 'More than $150,000'] },
    { id: 'f3', question: 'Are you interested in work-study programs?', options: ['Yes', 'No', 'Maybe'] },
  ],
};

/**
 * Generates an AI-powered summary of a user's profile by calling a Dify workflow.
 * @param {object} profile - The user's profile document from Mongoose.
 * @returns {Promise<string>} - An AI-generated summary string.
 */
const generateProfileSummary = async (profile) => {
  let profileString = "--- Student Profile ---\n"; // Initialize the correct variable

  if (profile.questionnaire && profile.questionnaire.length > 0) {
    profileString += "Questionnaire Answers:\n"; // Append to the correct variable
    profile.questionnaire.forEach(item => {
      profileString += `- ${item.question}: ${item.answer}\n`; // Append to the correct variable
    });
  }

  if (profile.discovered && profile.discovered.interests && profile.discovered.interests.length > 0) {
    profileString += "Discovered Interests: " + profile.discovered.interests.join(', ') + "\n";
  }
  
  if (profile.discovered && profile.discovered.strengths && profile.discovered.strengths.length > 0) {
    profileString += "Discovered Strengths: " + profile.discovered.strengths.join(', ') + "\n";
  }
  profileString = profileString.trim();
  console.log("---- Sending this string to Dify for summarization ----\n", profileString);

  // --- Step B: Call the Dify Summarization Workflow ---
  try {
    const difyBody = {
      inputs: {
        "profile": profileString // Ensure this key matches your Dify summary workflow's input variable
      },
      response_mode: 'blocking',
      user: profile.userId
    };

    const aiData = await callDifyWorkflow(
      process.env.DIFY_WORKFLOW_URL,
      process.env.PROFILE_SUMMARY_KEY,
      difyBody
    );

    // 3. Return the summary from Dify's response
    // Ensure 'summary' is the key for the text response you set in this Dify workflow
    const summary = aiData.data.outputs.summary; 
    console.log(`[SUCCESS] Dify generated profile summary for user: ${profile.userId}`);
    return summary;

  } catch (error) {
    console.error("Failed to generate profile summary from Dify:", error);
    // Fallback to the simple string if the AI call fails
    return profileString; 
  }
};

// Export the function and the constant so they can be used in other files
module.exports = {
    generateProfileSummary,
    ALL_QUESTIONS,
};