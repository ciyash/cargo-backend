import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({
  testName: { type: String, required: true },
  testDescription: { type: String, required: true },
},{
    timestamps: true,
});



export default  mongoose.model('Test', testSchema);