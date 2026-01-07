import React, { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import SEO from '../components/SEO.jsx'

export default function Projects() {
  const [selectedProject, setSelectedProject] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchProjects() {
      setLoading(true)
      setError('')
      try {
        const q = query(collection(db, 'projects'), orderBy('created', 'asc'))
        const querySnapshot = await getDocs(q)
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setProjects(docs)
      } catch (err) {
        console.error('Error fetching projects:', err)
        setError('Failed to load projects: ' + (err.message || 'Unknown error'))
      }
      setLoading(false)
    }
    fetchProjects()
  }, [])

  const handleImageClick = (project) => {
    setSelectedProject(project)
    setCurrentIndex(0)
  }

  const closeModal = () => {
    setSelectedProject(null)
    setCurrentIndex(0)
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? selectedProject.images.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === selectedProject.images.length - 1 ? 0 : prev + 1))
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedProject) return
      if (e.key === 'ArrowLeft') goToPrevious()
      if (e.key === 'ArrowRight') goToNext()
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedProject])

  if (loading) {
    return <div>Loading projects...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <>
      <SEO
        title="Recent Projects Gallery | Nature & Steel Bespoke"
        description="View our portfolio of recent commissions, collaborations, and bespoke furniture projects. See examples of our handcrafted work and custom designs."
      />
      <div>
      <h1 className="h1">Projects</h1>
      <p className="muted">
        Explore the gallery of recent commissions, collaborations, and pop-up shows. For custom work, reach out anytime at{' '}
        <a className="link-colored" href="mailto:natureandsteelbespoke@gmail.com">
          natureandsteelbespoke@gmail.com
        </a>
        .
      </p>
      <div className="projects-gallery" aria-label="Projects gallery">
        {projects.map((project, idx) => {
          // assign explicit area classes a-l so the grid forms a fixed rectangle
          const areaNames = ['a','b','c','d','e','f','g','h','i','j','k','l']
          const areaClass = areaNames[idx] ? `area-${areaNames[idx]}` : ''
          const className = project.className || '' // allow override, but default to empty for most
          return (
            <figure
              className={`projects-gallery__item ${className} ${areaClass}`.trim()}
              key={project.id}
              onClick={() => handleImageClick(project)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleImageClick(project)
                }
              }}
            >
              <img src={project.mainImage} alt={project.title || 'Project image'} loading="lazy" />
            </figure>
          )
        })}
      </div>

      {/* Fullscreen Modal */}
      {selectedProject && (
        <div className="image-modal" onClick={closeModal}>
          <div className="image-modal__container" onClick={(e) => e.stopPropagation()}>
            <button
              className="image-modal__close"
              onClick={closeModal}
              aria-label="Close gallery"
              type="button"
            >
              ✕
            </button>
            {selectedProject.images.length > 1 && (
              <>
                <button
                  className="image-modal__nav image-modal__nav--prev"
                  onClick={goToPrevious}
                  aria-label="Previous image"
                  type="button"
                >
                  ‹
                </button>
                <button
                  className="image-modal__nav image-modal__nav--next"
                  onClick={goToNext}
                  aria-label="Next image"
                  type="button"
                >
                  ›
                </button>
              </>
            )}
            <img src={selectedProject.images[currentIndex]} alt={selectedProject.title || 'Project image'} />
            {selectedProject.images.length > 1 && (
              <div className="image-modal__counter">
                {currentIndex + 1} / {selectedProject.images.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  )
}
