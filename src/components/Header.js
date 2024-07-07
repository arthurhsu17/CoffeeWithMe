import React from 'react';
import { Link } from 'react-router-dom';

function Header() {
  return (
    <header className="bg-primary text-primary-content shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <nav className="flex justify-between items-center">
          <Link to="/" className="flex items-center">
            <img 
              src={process.env.PUBLIC_URL + '/coffee.ico'} 
              alt="Coffee Finder Logo" 
              className="h-8 w-auto mr-2"
            />
            <div className="flex flex-col">
              <span className="text-2xl font-bold">CoffeeWithMe</span>
              <span className="text-sm -mt-1">by Arthur Hsu</span>
            </div>

          </Link>
          <ul className="flex space-x-4">
            <li><Link to="/" className="hover:text-secondary">Home</Link></li>
            <li><Link to="/about" className="hover:text-secondary">About</Link></li>
            <li><Link to="/contact" className="hover:text-secondary">Contact</Link></li>
            <li><Link to="/map" className="hover:text-secondary">Map</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default Header;