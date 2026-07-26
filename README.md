# Adaptive AI Tutor

A personalized learning application that adapts question difficulty and learning style in real time.

## What it does

- Models learner progress using Bayesian Knowledge Tracing (BKT)
- Generates practice questions with Groq-hosted Llama
- Adjusts question difficulty and presentation style based on learner performance
- Stores learner and session data with LibSQL
- Provides a responsive web interface for interactive tutoring

## Tech stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Groq SDK
- LibSQL

## Live demo

https://adaptive-ai-tutor-nine.vercel.app

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file from the example and add the required credentials.

3. Start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Project focus

This project demonstrates full-stack TypeScript development, AI integration, learner-state modeling, and adaptive user experiences.
