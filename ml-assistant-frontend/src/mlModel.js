import * as tf from '@tensorflow/tfjs';
import dataset from './symptom_condition_dataset.json';

// Extract unique symptoms and conditions
const allSymptoms = Array.from(new Set(dataset.flatMap(d => d.symptoms)));
const allConditions = Array.from(new Set(dataset.map(d => d.condition)));

// Encode symptoms as binary vectors
function encodeSymptoms(symptoms) {
  return allSymptoms.map(symptom => symptoms.includes(symptom) ? 1 : 0);
}

// Encode condition as one-hot
function encodeCondition(condition) {
  return allConditions.map(c => c === condition ? 1 : 0);
}

// Prepare training data
const xs = tf.tensor2d(dataset.map(d => encodeSymptoms(d.symptoms)));
const ys = tf.tensor2d(dataset.map(d => encodeCondition(d.condition)));

// Build a simple model
export async function trainModel() {
  const model = tf.sequential();
  model.add(tf.layers.dense({inputShape: [allSymptoms.length], units: 16, activation: 'relu'}));
  model.add(tf.layers.dense({units: allConditions.length, activation: 'softmax'}));
  model.compile({optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy']});
  await model.fit(xs, ys, {epochs: 100, verbose: 0});
  return model;
}

export { allSymptoms, allConditions, encodeSymptoms };
