import { useState } from 'react'
import { HomeScreen } from './screens/HomeScreen'
import { SpinScreen } from './screens/SpinScreen'
import { RevealScreen } from './screens/RevealScreen'
import { ResultScreen } from './screens/ResultScreen'
import { StampScreen } from './screens/StampScreen'

export type Screen = 'home' | 'spin' | 'reveal' | 'result' | 'stamp' | 'spots' | 'share'

function App() {
  const [screen, setScreen] = useState<Screen>('home')

  switch (screen) {
    case 'spin':
      return <SpinScreen onNavigate={setScreen} />
    case 'reveal':
      return <RevealScreen onNavigate={setScreen} />
    case 'result':
      return <ResultScreen onNavigate={setScreen} />
    case 'stamp':
      return <StampScreen onNavigate={setScreen} />
    default:
      return <HomeScreen onNavigate={setScreen} />
  }
}

export default App
