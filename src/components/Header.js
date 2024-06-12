// src/components/Header.js
import React , {useEffect, useState} from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <div>
        <button><Link to="/">Home</Link></button>
        <button><Link to="/about">About</Link></button>
        <button><Link to="/contact">Contact</Link></button>
        <button><Link to="/map">Map</Link></button>
    </div>
  );
};

export default Header;
