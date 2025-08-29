import React, { useState } from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from 'firebase/auth';

const ALLOWED_ADMINS = [
  'knott.mail8@gmail.com', // <-- Replace with your allowed admin emails
  // 'anotheradmin@email.com',
];

export default function Admin() {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setAuthError('Login failed: ' + err.message);
    }
  };

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
  };

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setError('');
    setSuccess(false);
    try {
      let imageUrl = '';
      if (image) {
        const imageRef = ref(storage, `furniture/${Date.now()}_${image.name}`);
        await uploadBytes(imageRef, image);
        imageUrl = await getDownloadURL(imageRef);
      }
      await addDoc(collection(db, 'furniture'), {
        name,
        description,
        price: parseFloat(price),
        imageUrl,
        created: Timestamp.now(),
      });
      setSuccess(true);
      setName('');
      setDescription('');
      setPrice('');
      setImage(null);
    } catch (err) {
      setError('Upload failed: ' + err.message);
    }
    setUploading(false);
  };

  // Restrict access to allowed admins only
  if (user && !ALLOWED_ADMINS.includes(user.email)) {
    return (
      <div style={{ maxWidth: 400, margin: '2rem auto', color: 'red' }}>
        <h2>Access Denied</h2>
        <p>This Google account is not authorized for admin access.</p>
        <button onClick={handleLogout}>Sign Out</button>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 400, margin: '2rem auto' }}>
        <h2>Admin Login</h2>
        <button onClick={handleGoogleLogin} style={{ width: '100%', marginBottom: 8 }}>Sign in with Google</button>
        {authError && <div style={{ color: 'red', marginTop: 8 }}>{authError}</div>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto' }}>
      <h2>Add New Furniture</h2>
      <button onClick={handleLogout} style={{ float: 'right', marginBottom: 16 }}>Sign Out</button>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          style={{ width: '100%', marginBottom: 8 }}
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          required
          style={{ width: '100%', marginBottom: 8 }}
        />
        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={e => setPrice(e.target.value)}
          required
          style={{ width: '100%', marginBottom: 8 }}
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={{ marginBottom: 8 }}
        />
        <button type="submit" disabled={uploading} style={{ width: '100%' }}>
          {uploading ? 'Uploading...' : 'Add Furniture'}
        </button>
      </form>
      {success && <div style={{ color: 'green', marginTop: 8 }}>Upload successful!</div>}
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  );
}
