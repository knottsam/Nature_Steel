import React from 'react'
import SEO from '../components/SEO.jsx'

export default function About() {
  return (
    <>
      <SEO
        title="About Nature & Steel Bespoke | Handcrafted Furniture Makers"
        description="Learn about Nature & Steel Bespoke, creators of durable, timeless handcrafted furniture and bespoke art pieces. We build unique statement pieces without breaking the bank."
      />
      <div>
        <h1 className="h1">About Us</h1>
        <p>
          At Nature & Steel Bespoke, we build durable, timeless furniture, creating unique pieces.
          One of a kind statement pieces of furniture. Our mission: elevate everyday living spaces, without breaking the bank.
        </p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
          <div className="card">
            <img
              src="https://images.unsplash.com/photo-1556157382-97eda2d62296?q=80&w=400&auto=format&fit=crop"
              alt="Mark - Portrait"
              style={{ width: '100%', height: '300px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem' }}
            />
            <h2>Hi, I'm Mark</h2>
            <p>
              <p>I’m a sheet metal worker who builds tough, functional pieces that are made to take a beating and still look good doing it. I work across multiple materials, mixing metal with other media when it makes sense for strength, finish, or style. If it needs to be solid, clean, and built properly, I’m in my element.</p>
              <p>I specialise in bigger builds, especially custom furniture and one-off projects. That might be a heavy-duty table frame, industrial shelving, brackets and supports, or a bespoke piece designed around a specific space. I’m all about strong structure, clean lines, and the kind of build quality you can feel when you grab it, lean on it, and actually use it.</p>
              <p>I’m particular about the details too: tight joins, tidy welds, and finishes that are built for real life. Whether you want raw and industrial, coated and clean, or something that sits somewhere in between, I’ll recommend what works best for the environment and how the piece will be used.</p>
              <p>I also do the whole job end-to-end. From design and measurements, through fabrication and finishing, right through to installation. No bouncing between different people, no broken communication, no “that wasn’t in my scope.” It stays consistent from first conversation to final fit, and it gets done properly.</p>
              <p>If you’ve got an idea you want bringing to life, or you need someone to help shape the idea into something that actually works, I’m happy to talk it through and build it right.</p>
            </p>
          </div>
          <div className="card">
            <img
              src="https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?q=80&w=400&auto=format&fit=crop"
              alt="Sam - Portrait"
              style={{ width: '100%', height: '300px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem' }}
            />
            <h2>Hi, I’m Sam</h2>
            <p>
              <p>I’ve been woodworking for just over a year, but I fell hard for the craft fast. What started as curiosity turned into an obsession with precision, texture, and the quiet satisfaction of making something that will get used every day.</p>
              <p>I specialise in small, detail-driven pieces made on the lathe, especially pens, rings, and other compact items where tiny choices make a big difference. I love working with exotic woods because every blank has its own personality: colour shifts, grain movement, figuring, and those little surprises you only see once the tool starts cutting. No two pieces ever come out the same, and that’s the point.</p>
              <p>I’m picky about materials and even pickier about finish. I want my work to feel great in the hand, hold up to real use, and age well. A pen shouldn’t just write, it should feel like your pen. A ring should look sharp, be comfortable, and spark the “where did you get that?” question.</p>
              <p>Everything I make is shaped slowly and deliberately, with a focus on clean lines, crisp details, and a finish that brings the wood to life. I enjoy experimenting too, pairing timbers, testing new profiles, and trying different oils and polishes to get the best possible result from each piece.</p>
              <p>If you’d like something personal, I also take custom requests. Whether it’s a specific wood, a particular style, or a gift with meaning behind it, I’m always up for making something that tells a story.</p>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
