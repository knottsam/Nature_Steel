import React, { useState } from 'react'

const projectsGalleryImages = [
  {
    src: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80',
    alt: 'Contemporary furniture design',
    className: 'projects-gallery__item--wide projects-gallery__item--tall',
  },
  {
    src: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80',
    alt: 'Designer chair detail',
    className: 'projects-gallery__item--tall',
  },
  {
    src: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    alt: 'Bar interior seating and lighting',
    className: 'projects-gallery__item--tall',
  },
  {
    src: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80',
    alt: 'Restaurant interior and seating',
    className: '',
  },
  {
    src: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80',
    alt: 'Wood furniture close-up',
    className: 'projects-gallery__item--wide',
  },
  {
    src: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?auto=format&fit=crop&w=900&q=80',
    alt: 'Modern furniture composition',
    className: '',
  },
  {
    src: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80',
    alt: 'Furniture CAD render',
    className: '',
  },
  {
    src: 'https://images.unsplash.com/photo-1452965204753-0ad4a2270ab7?auto=format&fit=crop&w=900&q=80',
    alt: 'Cocktail bar interior',
    className: 'projects-gallery__item--wide',
  },
  {
    src: 'https://images.unsplash.com/photo-1437915361023-53d5b4c6b2d7?auto=format&fit=crop&w=900&q=80',
    alt: 'Dining area interior',
    className: '',
  },
  {
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=80',
    alt: 'Furniture blueprint / CAD',
    className: 'projects-gallery__item--tall',
  },
  {
    src: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=900&q=80',
    alt: 'Restaurant and bar seating',
    className: '',
  },
  {
    src: 'https://images.unsplash.com/photo-1511379938547-c1f69b13d835?auto=format&fit=crop&w=900&q=80',
    alt: 'Furniture workshop and fabrication',
    className: '',
  },
]

export default function Projects() {
  const [selectedImage, setSelectedImage] = useState(null)

  const handleImageClick = (image) => {
    setSelectedImage(image)
  }

  const closeModal = () => {
    setSelectedImage(null)
  }

  return (
    <div>
      <h1 className="h1">Projects</h1>
      <p className="muted">
        Explore the gallery of recent commissions, collabs, and pop-up activations. For showings
        or custom work, reach out anytime at{' '}
        <a className="link-underline" href="mailto:hello@natures-steel.com">
          hello@natures-steel.com
        </a>
        .
      </p>
      <div className="projects-gallery" aria-label="Projects gallery">
        {projectsGalleryImages.map((image, idx) => {
          // assign explicit area classes a-l so the grid forms a fixed rectangle
          const areaNames = ['a','b','c','d','e','f','g','h','i','j','k','l']
          const areaClass = areaNames[idx] ? `area-${areaNames[idx]}` : ''
          return (
            <figure
              className={`projects-gallery__item ${image.className} ${areaClass}`.trim()}
              key={image.src}
              onClick={() => handleImageClick(image)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleImageClick(image)
                }
              }}
            >
              <img src={image.src} alt={image.alt} loading="lazy" />
            </figure>
          )
        })}
      </div>

      {/* Fullscreen Modal */}
      {selectedImage && (
        <div className="image-modal" onClick={closeModal}>
          <div className="image-modal__container" onClick={(e) => e.stopPropagation()}>
            <button
              className="image-modal__close"
              onClick={closeModal}
              aria-label="Close image"
              type="button"
            >
              ✕
            </button>
            <img src={selectedImage.src} alt={selectedImage.alt} />
          </div>
        </div>
      )}
    </div>
  )
}
