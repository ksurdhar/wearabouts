# Wearabouts

An outfit recommendation app that combines weather forecasting with clothing suggestions based on location and context.

Enter a location, event, or vibe (like "ivy league weekend" or "Yankees vs Red Sox in May") and get a 7-day forecast with outfit recommendations for each day. The app uses AI to understand natural language queries and provides weather-appropriate clothing suggestions.

## Tech Stack

- **Next.js 15** - React framework using the App Router
- **TypeScript** - Type safety throughout
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Animations and transitions
- **Zod** - Runtime schema validation
- **OpenAI GPT-4** - Natural language processing
- **Open-Meteo** - Weather data API

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main app component
│   └── api/
│       ├── resolve/          # Location resolution endpoint
│       ├── forecast/         # Weather data endpoint
│       └── generate-outfits/ # Outfit recommendations endpoint
├── components/
│   ├── SearchForm.tsx        # Search input UI
│   ├── LocationCard.tsx     # Display resolved location
│   ├── ForecastCard.tsx     # Individual day forecast
│   ├── ForecastGrid.tsx     # 7-day forecast layout
│   └── GlobeASCII.tsx       # Loading animation
├── hooks/
│   ├── useSearchWorkflow.ts    # Main orchestration hook
│   ├── useLocationResolver.ts  # Location API integration
│   ├── useForecast.ts         # Weather fetching
│   └── useOutfitGenerator.ts  # Outfit generation
└── lib/
    ├── schemas.ts            # Zod schemas and types
    └── date-utils.ts         # Date formatting helpers
```

## How It Works

### Frontend Flow
1. User enters a query in the search form
2. `useSearchWorkflow` hook orchestrates the data flow
3. Location is resolved, then weather is fetched, then outfits are generated
4. Results display in an animated transition from search to results view

### API Routes

**`/api/resolve`**
- Takes a user query and returns location coordinates
- Uses OpenAI to parse natural language into locations
- Falls back through multiple prompt strategies if initial attempts fail
- Returns confidence scores and alternative location suggestions

**`/api/forecast`**
- Takes latitude/longitude and fetches weather from Open-Meteo
- Processes raw weather codes into readable conditions (sun, rain, snow, etc.)
- Returns 7-day forecast with temperature, precipitation, UV index, and wind

**`/api/generate-outfits`**
- Takes location and weather data to generate outfit recommendations
- Uses temperature-based rules for clothing layers
- Adds weather-specific items (umbrellas, sunglasses, etc.)
- Optionally enhances with AI-generated contextual advice

## Setup

```bash
# Install dependencies
npm install

# Set environment variables
OPENAI_API_KEY=your-key-here

# Run development server
npm run dev
```

## Architecture Decisions

The codebase prioritizes:
- **Separation of concerns** - UI components don't contain business logic
- **Type safety** - Zod schemas validate data at runtime and generate TypeScript types
- **Error resilience** - Every external API call has retry logic and timeout protection
- **Clean abstractions** - Complex workflows are encapsulated in reusable hooks
