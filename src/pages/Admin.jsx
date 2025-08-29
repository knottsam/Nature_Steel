import React, { useState } from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc, Timestamp, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getAuth, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from 'firebase/auth';

const ALLOWED_ADMINS = [
  'knott.mail8@gmail.com',
  'natureandsteelbespoke@gmail.com',
  // 'anotheradmin@email.com',
];

export default function Admin() {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState('');
  const [craftsmanship, setCraftsmanship] = useState('');
  const [customizable, setCustomizable] = useState(true);
  const [editId, setEditId] = useState(null);
  const [existingImages, setExistingImages] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]);

  React.useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    // Fetch items from Firestore
    async function fetchItems() {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'furniture'));
        setItems(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        // Optionally handle error
      }
      setLoading(false);
    }
    fetchItems();
  }, [success]); // refetch when success changes

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
    if (e.target.files && e.target.files.length > 0) {
      setImages(Array.from(e.target.files));
    }
  };

  // When clicking edit, load item data into form
  const handleEdit = (item) => {
    setEditId(item.id);
    setName(item.name || '');
    setDescription(item.description || '');
    setPrice(item.price ? (item.price / 100).toString() : '');
    setMaterials(item.materials || '');
    setCraftsmanship(item.craftsmanship || '');
    setCustomizable(item.customizable !== undefined ? item.customizable : true);
    setExistingImages(item.images || []);
    setImages([]); // new images to add
  };

  // Remove an existing image from the list and mark for deletion
  const handleRemoveExistingImage = (url) => {
    setExistingImages(imgs => imgs.filter(img => img !== url));
    setImagesToDelete(list => [...list, url]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setError('');
    setSuccess(false);
    try {
      let imageUrls = [...existingImages];
      if (images.length > 0) {
        for (const img of images) {
          const imageRef = ref(storage, `furniture/${Date.now()}_${img.name}`);
          await uploadBytes(imageRef, img);
          const url = await getDownloadURL(imageRef);
          imageUrls.push(url);
        }
      }
      // Delete images from Firebase Storage if needed
      if (imagesToDelete.length > 0) {
        for (const url of imagesToDelete) {
          try {
            // Extract the storage path from the URL
            const baseUrl = `https://firebasestorage.googleapis.com/v0/b/${import.meta.env.VITE_FIREBASE_STORAGE_BUCKET}/o/`;
            if (url.startsWith(baseUrl)) {
              const path = decodeURIComponent(url.substring(baseUrl.length, url.indexOf('?')));
              await deleteObject(storageRef(storage, path));
            }
          } catch (err) {
            // Ignore errors for missing files
          }
        }
      }
      const pricePence = Math.round(parseFloat(price) * 100);
      const data = {
        name,
        description,
        price: pricePence,
        images: imageUrls,
        materials,
        craftsmanship,
        customizable,
        created: editId ? undefined : Timestamp.now(),
      };
      if (editId) {
        // Remove undefined fields
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
        await updateDoc(doc(db, 'furniture', editId), data);
        setEditId(null);
      } else {
        await addDoc(collection(db, 'furniture'), data);
      }
      setSuccess(true);
      setName('');
      setDescription('');
      setPrice('');
      setImages([]);
      setExistingImages([]);
      setImagesToDelete([]);
      setMaterials('');
      setCraftsmanship('');
      setCustomizable(true);
    } catch (err) {
      setError('Upload failed: ' + err.message);
    }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    const item = items.find(i => i.id === id);
    if (!window.confirm('Delete this item?')) return;
    try {
      // Delete Firestore document
      await deleteDoc(doc(db, 'furniture', id));
      // Delete image from Storage if it exists
      if (item && item.images) {
        try {
          for (const imageUrl of item.images) {
            // Extract the path after the bucket domain
            const url = new URL(imageUrl);
            const pathMatch = url.pathname.match(/\/o\/(.+)$/);
            let storagePath = '';
            if (pathMatch && pathMatch[1]) {
              storagePath = decodeURIComponent(pathMatch[1]);
            } else if (imageUrl.includes('furniture/')) {
              // fallback: try to extract from known pattern
              storagePath = imageUrl.split('/furniture/')[1];
              if (storagePath) storagePath = 'furniture/' + storagePath.split('?')[0];
            }
            if (storagePath) {
              const imageRef = ref(storage, storagePath);
              await deleteObject(imageRef);
            }
          }
        } catch (err) {
          // Optionally handle image delete error
        }
      }
      setItems(items => items.filter(item => item.id !== id));
    } catch (err) {
      setError('Delete failed: ' + err.message);
    }
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
    <>
      <div style={{ maxWidth: 400, margin: '2rem auto' }}>
        <h2>{editId ? 'Edit' : 'Add New'} Item</h2>
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
            type="text"
            placeholder="Materials"
            value={materials}
            onChange={e => setMaterials(e.target.value)}
            required
            style={{ width: '100%', marginBottom: 8 }}
          />
          <input
            type="text"
            placeholder="Craftsmanship"
            value={craftsmanship}
            onChange={e => setCraftsmanship(e.target.value)}
            required
            style={{ width: '100%', marginBottom: 8 }}
          />
          <input
            type="number"
            placeholder="Price (£)"
            value={price}
            onChange={e => setPrice(e.target.value)}
            required
            style={{ width: '100%', marginBottom: 8 }}
          />
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={customizable}
              onChange={e => setCustomizable(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Customizable (allow custom art/artist selection)
          </label>
          {existingImages.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <strong>Existing images:</strong>
              <ul style={{ paddingLeft: 16 }}>
                {existingImages.map((url, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={url} alt="existing" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }} />
                    <button type="button" onClick={() => handleRemoveExistingImage(url)} style={{ color: 'red' }}>Remove</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            style={{ marginBottom: 8 }}
          />
          {images.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <strong>Selected images:</strong>
              <ul style={{ paddingLeft: 16 }}>
                {images.map((img, i) => <li key={i}>{img.name}</li>)}
              </ul>
            </div>
          )}
          <button type="submit" disabled={uploading} style={{ width: '100%' }}>
            {uploading ? (editId ? 'Saving...' : 'Uploading...') : (editId ? 'Save Changes' : 'Add Item')}
          </button>
          {editId && (
            <button type="button" onClick={() => {
              setEditId(null);
              setName('');
              setDescription('');
              setPrice('');
              setImages([]);
              setExistingImages([]);
              setMaterials('');
              setCraftsmanship('');
              setCustomizable(true);
            }} style={{ width: '100%', marginTop: 8 }}>Cancel Edit</button>
          )}
        </form>
        {success && <div style={{ color: 'green', marginTop: 8 }}>Upload successful!</div>}
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      </div>
      <hr style={{ margin: '2rem 0' }} />
      <h3>Existing Items</h3>
      {loading ? <div>Loading...</div> : (
        <div className="admin-items-grid">
          {items.map(item => (
            <div key={item.id} style={{
              border: '1px solid #353634',
              borderRadius: 12,
              padding: 16,
              background: 'var(--surface)',
              boxShadow: '0 2px 8px 0 rgba(40,30,20,0.08)',
              minHeight: 180,
            }}>
              <strong>{item.name}</strong><br />
              {item.images && item.images[0] && <img src={item.images[0]} alt={item.name} style={{ maxWidth: '100%', maxHeight: 100, borderRadius: 8, margin: '8px 0' }} />}<br />
              <button onClick={() => handleEdit(item)} style={{ marginRight: 8, marginBottom: 6 }}>Edit</button>
              <button onClick={() => handleDelete(item.id)} style={{ color: 'red', marginTop: 0 }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
