import React from 'react';
import { BrowserRouter as Router,Routes, Route} from 'react-router-dom';
import MapComponent from './components/MapComponent.js';
import About from './components/About.js';
import Home from './components/Home.js';
import Header from './components/Header.js';
import Contact from './components/Contact.js';
//import NearbyShops from './components/NearbyShops';
//import MidpointFinder from './components/MidpointFinder';

function App() {
  return (
    <Router>
      <Header/>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/map" element={<MapComponent />} />
      </Routes>
    </Router>
  );
}

export default App;
