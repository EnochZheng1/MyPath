import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    console.log("app main triggered");
    res.send('AI Counselor backend running');
});



app.listen(3001, () => {
  console.log('Server listening on port 3001');
});
