import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css'
import Home from './components/Home';
import Test from './components/Test';
import Launch from './components/Launch';
import LaunchCallback from './components/LaunchCallback';
import PatientDashboard from './components/PatientDashboard';

function App() {
  return (
    <Router>
      <div className="app-wrapper">
        <nav>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/test">Test</Link>
            </li>
          </ul>
        </nav>

        <div className="content-area">
          <Routes>
            <Route path="/launch" element={<Launch />} />
            <Route path="/launch-callback" element={<LaunchCallback />} />
            <Route path="/patient-dashboard" element={<PatientDashboard />} />
            <Route path="/test" element={<Test />} />
            <Route path="/" element={<Home />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

export default App
