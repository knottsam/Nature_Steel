import skegFace from '../assets/images/skeg_face.jpg'
import skegEg1 from '../assets/images/Skeg_Eg1.jpg'
import skegEg2 from '../assets/images/Skeg_Eg2.jpg'
import skegEg3 from '../assets/images/Skeg_Eg3.jpg'
import skegEg4 from '../assets/images/Skeg_Eg4.png'
import skegEg5 from '../assets/images/Skeg_Eg5.png'
import skegEg6 from '../assets/images/Skeg_Eg6.png'
import skegClock1 from '../assets/images/Skeg_Clock1.jpg'
import skegClock2 from '../assets/images/Skeg_Clock2.jpg'

export const artists = [
  {
    id: 'a1',
    name: '@lets_have_a_skeg',
    slug: 'artist-skeg',
    feePence: 15000,
    style: 'Bold, high-contrast letterforms with neon accents.',
    bio: '@lets_have_a_skeg has painted large-scale murals across Europe, known for precise linework and layered textures.',
    thumbnail: skegFace,
    gallery: [
      skegEg1,
      skegEg2,
      skegEg3,
      skegEg4,
      skegEg5,
      skegEg6,
      skegClock1,
      skegClock2,
    ]
  }
]
