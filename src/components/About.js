// src/components/About.js
import React from 'react';
import '../styles/About.css'; 

const About = () => {
  return (
    <div className="about-container">
      <h1>About CoffeeWithMe</h1>
      <section className="about-section">
        <p>
          CoffeeWithMe is an innovative web application designed to help coffee lovers find the nearest coffee shops and determine the best meeting spots between two locations. Whether you prefer walking, driving, or using public transport, our app ensures you get to your coffee destination with ease.
        </p>
        <h2>Features</h2>
        <ul>
          <li>Find the nearest coffee shops based on your current location.</li>
          <li>Calculate the midpoint between two locations for convenient meetups.</li>
          <li>Get directions for walking, driving, or public transport.</li>
        </ul>
        <h2>Our Mission</h2>
        <p>
          At CoffeeWithMe, we aim to connect coffee enthusiasts by providing an easy and efficient way to discover and visit coffee shops. We believe that every great conversation starts with a good cup of coffee, and our mission is to make that experience accessible and enjoyable for everyone.
        </p>
        <h2>Contact Us</h2>
        <p>
          Have any questions or feedback? Feel free to <a href="/contact">contact us</a>. We'd love to hear from you!
        </p>
      </section>
    </div>
  );
};

export default About;
