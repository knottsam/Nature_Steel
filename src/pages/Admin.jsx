import React, { useState } from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc, Timestamp, getDocs, deleteDoc, doc, updateDoc, setDoc, query, orderBy, deleteField, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getAuth, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from 'firebase/auth';
import { useSiteConfig } from '../context/SiteConfigContext.jsx';
import { DEFAULT_SITE_VISIBILITY, SITE_VISIBILITY_DOC } from '../config/siteVisibility.js';
import { GALLERY_LIMIT } from '../utils/gallery.js';

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
  const [deliveryCost, setDeliveryCost] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState('');
  const [material, setMaterial] = useState('');
  const [itemType, setItemType] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [customizable, setCustomizable] = useState(false);
  const [availableMaterials, setAvailableMaterials] = useState('');
  const [published, setPublished] = useState(true);
  const [galleryFeatured, setGalleryFeatured] = useState(false);
  const [editId, setEditId] = useState(null);
  const [existingImages, setExistingImages] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]);
  const [galleryCount, setGalleryCount] = useState(0);
  const [editingWasGalleryFeatured, setEditingWasGalleryFeatured] = useState(false);
  // Admin mode: 'orders' or 'inventory'
  const [mode, setMode] = useState('orders');
  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');  // Projects state
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsError, setProjectsError] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [projectImages, setProjectImages] = useState([])
  const [projectMainImage, setProjectMainImage] = useState('')
  const [projectExistingImages, setProjectExistingImages] = useState([])
  const [projectImagesToDelete, setProjectImagesToDelete] = useState([])
  const [projectEditId, setProjectEditId] = useState(null)
  const { config: siteConfig, loading: siteConfigLoading } = useSiteConfig();
  const [toggleMessage, setToggleMessage] = useState('');
  const [toggleError, setToggleError] = useState('');
  const [toggleLoading, setToggleLoading] = useState({
    artistsEnabled: false,
    artistPagesEnabled: false,
  });

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
      setError(''); // Clear previous errors
      try {
        console.log('[Admin] Fetching furniture collection...');
        console.log('[Admin] Current user:', user?.email, user?.uid, 'verified:', user?.emailVerified);
        const querySnapshot = await getDocs(collection(db, 'furniture'));
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('[Admin] Fetched', docs.length, 'items');
        setItems(docs);
      } catch (err) {
        // Surface permission/config errors to the UI to help diagnose
        console.error('[Admin] Fetch error:', err);
        setError('Load failed: ' + (err?.code || '') + ' - ' + (err?.message || 'Unknown error'));
      }
      setLoading(false);
    }
    if (user) {
      fetchItems();
    }
  }, [success, user]); // refetch when success changes or user signs in

  // Fetch orders when in orders mode
  React.useEffect(() => {
    async function fetchOrders() {
      setOrdersLoading(true);
      setOrdersError('');
      try {
        const q = query(collection(db, 'orders'), orderBy('created', 'desc'));
        const snap = await getDocs(q);
        let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Clean up old pending orders (older than 48 hours)
        const now = new Date();
        const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));

        const ordersToDelete = list.filter(order => {
          if (order.status !== 'PENDING') return false;
          const createdDate = order.created?.toDate ? order.created.toDate() : new Date(order.created);
          return createdDate < fortyEightHoursAgo;
        });

        if (ordersToDelete.length > 0) {
          console.log(`[Admin] Deleting ${ordersToDelete.length} old pending orders...`);
          for (const order of ordersToDelete) {
            try {
              await deleteDoc(doc(db, 'orders', order.id));
              console.log(`[Admin] Deleted old pending order: ${order.id}`);
            } catch (deleteErr) {
              console.error(`[Admin] Failed to delete order ${order.id}:`, deleteErr);
            }
          }
          // Refetch after cleanup
          const freshSnap = await getDocs(q);
          list = freshSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        setOrders(list);
      } catch (err) {
        console.error('[Admin] Orders fetch error:', err);
        setOrdersError('Failed to load orders: ' + (err?.message || 'unknown'));
      }
      setOrdersLoading(false);
    }
    if (user && mode === 'orders') fetchOrders();
  }, [user, mode, success]);
  // Fetch projects when in projects mode
  React.useEffect(() => {
    async function fetchProjects() {
      setProjectsLoading(true)
      setProjectsError('')
      try {
        const q = query(collection(db, 'projects'), orderBy('created', 'asc'))
        const snap = await getDocs(q)
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setProjects(list)
      } catch (err) {
        console.error('[Admin] Projects fetch error:', err)
        setProjectsError('Failed to load projects: ' + (err?.message || 'unknown'))
      }
      setProjectsLoading(false)
    }
    if (user && mode === 'projects') fetchProjects()
  }, [user, mode, success])
  React.useEffect(() => {
    if (!user || mode !== 'inventory') return;
    const featuredCount = items.filter(item => item.galleryFeatured === true).length;
    setGalleryCount(featuredCount);
  }, [user, mode, items]);

  React.useEffect(() => {
    if (editId) return;
    setGalleryFeatured(false);
    setEditingWasGalleryFeatured(false);
  }, [galleryCount, editId]);

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
    setDeliveryCost(item.deliveryCost ? (item.deliveryCost / 100).toString() : '');
    const gallery = Array.isArray(item.images) && item.images.length
      ? item.images
      : (typeof item.imageUrl === 'string' && item.imageUrl ? [item.imageUrl] : []);
    setExistingImages(gallery);
    setImages([]); // new images to add
    setMaterials(item.materials || '');
    const existingMaterial = item.material ?? item.materials ?? '';
    setMaterial(typeof existingMaterial === 'string' ? existingMaterial : '');
    setItemType(item.itemType || '');
    const initialCover = typeof item.coverImage === 'string' && item.coverImage
      ? item.coverImage
      : (gallery[0] || '');
    setCoverImage(initialCover);
    setCustomizable(item.customizable !== undefined ? item.customizable : false);
    setAvailableMaterials(Array.isArray(item.availableMaterials) ? item.availableMaterials.join(', ') : '');
    setPublished(!!item.published);
    const isGalleryFeatured = item.galleryFeatured === true;
    setGalleryFeatured(isGalleryFeatured);
    setEditingWasGalleryFeatured(isGalleryFeatured);
  };

  // Remove an existing image from the list and mark for deletion
  const handleRemoveExistingImage = (url) => {
    setExistingImages((imgs) => {
      const next = imgs.filter(img => img !== url);
      if (coverImage === url) {
        setCoverImage(next[0] || '');
      }
      return next;
    });
    setImagesToDelete(list => [...list, url]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setError('');
    setSuccess(false);
    const wasGalleryFeatured = editingWasGalleryFeatured;
    try {
      let imageUrls = [...existingImages];
      if (images.length > 0) {
        console.log('[Admin] Uploading', images.length, 'image(s) to Storage...');
        for (const img of images) {
          const imageRef = ref(storage, `furniture/${Date.now()}_${img.name}`);
          try {
            await uploadBytes(imageRef, img);
            const url = await getDownloadURL(imageRef);
            imageUrls.push(url);
            console.log('[Admin] Uploaded:', url);
          } catch (uploadErr) {
            console.error('[Admin] Image upload failed:', uploadErr);
            throw new Error(`Image upload failed: ${uploadErr.message}`);
          }
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
              const imageRef = ref(storage, path);
              await deleteObject(imageRef);
            }
          } catch (err) {
            // Ignore errors for missing files
          }
        }
      }
      const priceNumber = parseFloat(price);
      if (!Number.isFinite(priceNumber)) {
        throw new Error('Please enter a valid price.');
      }
      const pricePence = Math.round(priceNumber * 100);
      const deliveryCostNumber = parseFloat(deliveryCost || '0');
      if (!Number.isFinite(deliveryCostNumber) || deliveryCostNumber < 0) {
        throw new Error('Please enter a valid delivery cost (0 or more).');
      }
      const deliveryCostPence = Math.round(deliveryCostNumber * 100);
      const normalizedMaterial = typeof material === 'string' ? material.trim() : '';
      const normalizedItemType = typeof itemType === 'string' ? itemType.trim() : '';
      const normalizedMaterials = typeof materials === 'string' ? materials.trim() : '';
      const normalizedCoverCandidate = typeof coverImage === 'string' ? coverImage.trim() : '';
      const finalCoverImage = normalizedCoverCandidate && imageUrls.includes(normalizedCoverCandidate)
        ? normalizedCoverCandidate
        : (imageUrls[0] || '');

      const dedupedImages = Array.from(new Set(imageUrls.filter(Boolean)));
      const orderedImages = finalCoverImage
        ? [finalCoverImage, ...dedupedImages.filter((img) => img !== finalCoverImage)]
        : dedupedImages;

      if (!normalizedMaterial) {
        throw new Error('Material is required.');
      }
      if (!normalizedItemType) {
        throw new Error('Item type is required.');
      }

      if (galleryFeatured && !wasGalleryFeatured && galleryCount >= GALLERY_LIMIT) {
        throw new Error(`Gallery is full (${galleryCount}/${GALLERY_LIMIT}). Unfeature another piece before adding this one.`);
      }

      const normalizedAvailableMaterials = typeof availableMaterials === 'string' 
        ? availableMaterials.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const data = {
        name: name.trim(),
        description: description.trim(),
        price: pricePence,
        deliveryCost: deliveryCostPence,
        images: orderedImages,
        materials: normalizedMaterials,
        material: normalizedMaterial,
        itemType: normalizedItemType,
        customizable,
        availableMaterials: normalizedAvailableMaterials,
        published,
        galleryFeatured,
        created: editId ? undefined : Timestamp.now(),
      };
      if (finalCoverImage) {
        data.coverImage = finalCoverImage;
      }
      Object.keys(data).forEach((key) => {
        if (data[key] === undefined) {
          delete data[key];
        }
      });
      let nextGalleryCount = galleryCount;
      if (editId) {
        // Remove undefined fields
        console.log('[Admin] Updating doc:', editId);
        await updateDoc(doc(db, 'furniture', editId), {
          ...data,
          craftsmanship: deleteField(),
          coverImage: finalCoverImage ? finalCoverImage : deleteField(),
          updated: Timestamp.now(),
        });
        console.log('[Admin] Update succeeded');
        setEditId(null);
        if (wasGalleryFeatured && !galleryFeatured) {
          nextGalleryCount = Math.max(0, nextGalleryCount - 1);
        } else if (!wasGalleryFeatured && galleryFeatured) {
          nextGalleryCount = Math.min(GALLERY_LIMIT, nextGalleryCount + 1);
        }
      } else {
        console.log('[Admin] Creating new doc with data:', data);
        const docRef = await addDoc(collection(db, 'furniture'), data);
        console.log('[Admin] Doc created with ID:', docRef.id);
        if (galleryFeatured) {
          nextGalleryCount = Math.min(GALLERY_LIMIT, nextGalleryCount + 1);
        }
      }
      if (nextGalleryCount !== galleryCount) {
        setGalleryCount(nextGalleryCount);
      }
      setSuccess(true);
      setName('');
      setDescription('');
      setPrice('');
      setDeliveryCost('');
      setImages([]);
      setExistingImages([]);
      setImagesToDelete([]);
      setMaterials('');
      setMaterial('');
      setItemType('');
      setCoverImage('');
      setCustomizable(false);
      setAvailableMaterials('');
      setPublished(true);
  setGalleryFeatured(false);
      setEditingWasGalleryFeatured(false);
    } catch (err) {
      console.error('[Admin] handleSubmit error:', err);
      const msg = err?.message || 'Unknown error';
      const code = err?.code || '';
      setError(`Upload failed: ${code ? code + ': ' : ''}${msg}`);
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
      if (item && item.galleryFeatured === true) {
        setGalleryCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      setError('Delete failed: ' + err.message);
    }
  };

  const handleProjectImageChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setProjectImages(Array.from(e.target.files))
    }
  }

  const handleRemoveProjectExistingImage = (url) => {
    setProjectExistingImages((imgs) => {
      const next = imgs.filter(img => img !== url)
      if (projectMainImage === url) {
        setProjectMainImage(next[0] || '')
      }
      return next
    })
    setProjectImagesToDelete(list => [...list, url])
  }

  const handleProjectEdit = (project) => {
    setProjectEditId(project.id)
    setProjectTitle(project.title || '')
    setProjectExistingImages(project.images || [])
    setProjectImages([])
    setProjectMainImage(project.mainImage || (project.images && project.images[0]) || '')
  }

  const handleProjectDelete = async (id) => {
    const project = projects.find(p => p.id === id)
    if (!window.confirm('Delete this project?')) return
    try {
      // Delete Firestore document
      await deleteDoc(doc(db, 'projects', id))
      // Delete images from Storage
      if (project && project.images) {
        for (const imageUrl of project.images) {
          const url = new URL(imageUrl)
          const pathMatch = url.pathname.match(/\/o\/(.+)$/)
          let storagePath = ''
          if (pathMatch && pathMatch[1]) {
            storagePath = decodeURIComponent(pathMatch[1])
          } else if (imageUrl.includes('projects/')) {
            storagePath = imageUrl.split('/projects/')[1]
            if (storagePath) storagePath = 'projects/' + storagePath.split('?')[0]
          }
          if (storagePath) {
            const imageRef = ref(storage, storagePath)
            await deleteObject(imageRef)
          }
        }
      }
      setProjects(projects => projects.filter(p => p.id !== id))
    } catch (err) {
      setError('Delete failed: ' + err.message)
    }
  }

  const handleProjectSubmit = async (e) => {
    e.preventDefault()
    setUploading(true)
    setError('')
    setSuccess(false)
    try {
      let imageUrls = [...projectExistingImages]
      if (projectImages.length > 0) {
        console.log('[Admin] Uploading', projectImages.length, 'project image(s) to Storage...')
        for (const img of projectImages) {
          const imageRef = ref(storage, `projects/${Date.now()}_${img.name}`)
          await uploadBytes(imageRef, img)
          const url = await getDownloadURL(imageRef)
          imageUrls.push(url)
          console.log('[Admin] Uploaded project image:', url)
        }
      }

      // Determine mainImage
      let finalMainImage = projectMainImage
      if (projectMainImage.startsWith('new-')) {
        const idx = parseInt(projectMainImage.split('-')[1])
        finalMainImage = imageUrls[projectExistingImages.length + idx]
      }
      if (!finalMainImage && imageUrls.length > 0) {
        finalMainImage = imageUrls[0]
      }

      const data = {
        title: projectTitle.trim(),
        images: imageUrls,
        mainImage: finalMainImage,
      }

      if (!projectEditId) {
        data.created = Timestamp.now();
      }

      if (projectEditId) {
        console.log('[Admin] Updating project:', projectEditId)
        await updateDoc(doc(db, 'projects', projectEditId), {
          ...data,
          updated: Timestamp.now(),
        })
        // Delete removed images
        if (projectImagesToDelete.length > 0) {
          for (const imageUrl of projectImagesToDelete) {
            const url = new URL(imageUrl)
            const pathMatch = url.pathname.match(/\/o\/(.+)$/)
            let storagePath = ''
            if (pathMatch && pathMatch[1]) {
              storagePath = decodeURIComponent(pathMatch[1])
            } else if (imageUrl.includes('projects/')) {
              storagePath = imageUrl.split('/projects/')[1]
              if (storagePath) storagePath = 'projects/' + storagePath.split('?')[0]
            }
            if (storagePath) {
              const imageRef = ref(storage, storagePath)
              await deleteObject(imageRef)
            }
          }
        }
        console.log('[Admin] Project update succeeded')
        setProjectEditId(null)
      } else {
        console.log('[Admin] Creating new project with data:', data)
        const docRef = await addDoc(collection(db, 'projects'), data)
        console.log('[Admin] Project created with ID:', docRef.id)
      }

      setSuccess(true)
      setProjectTitle('')
      setProjectImages([])
      setProjectExistingImages([])
      setProjectMainImage('')
      setProjectImagesToDelete([])
      setProjectImagesToDelete([])
    } catch (err) {
      console.error('[Admin] handleProjectSubmit error:', err)
      const msg = err?.message || 'Unknown error'
      const code = err?.code || ''
      setError(`Upload failed: ${code ? code + ': ' : ''}${msg}`)
    }
    setUploading(false)
  }

  const updateVisibilityFlag = async (field, nextValue) => {
    try {
      await updateDoc(SITE_VISIBILITY_DOC, { [field]: nextValue });
    } catch (err) {
      if (err?.code === 'not-found') {
        await setDoc(
          SITE_VISIBILITY_DOC,
          {
            ...DEFAULT_SITE_VISIBILITY,
            [field]: nextValue,
          },
          { merge: true },
        )
      } else {
        throw err
      }
    }
  }

  const handleVisibilityToggle = async (field) => {
    setToggleError('')
    setToggleMessage('')
    setToggleLoading(prev => ({ ...prev, [field]: true }))
    const currentValue = siteConfig?.[field]
    const nextValue = currentValue === undefined ? DEFAULT_SITE_VISIBILITY[field] : !currentValue
    try {
      await updateVisibilityFlag(field, nextValue)
      const label = field === 'artistsEnabled' ? 'Artists directory' : 'Artist profile pages'
      setToggleMessage(`${label} ${nextValue ? 'enabled' : 'disabled'}.`)
    } catch (err) {
      setToggleError('Visibility update failed: ' + (err?.message || err?.code || 'unknown error'))
    } finally {
      setToggleLoading(prev => ({ ...prev, [field]: false }))
    }
  }

  // Restrict access to allowed admins only
  if (user && !ALLOWED_ADMINS.includes(user.email)) {
    return (
      <div style={{ maxWidth: 400, margin: '2rem auto', color: 'red' }}>
        <h2>Access Denied</h2>
        <p>This Google account is not authorized for admin access.</p>
        <button type="button" onClick={handleLogout} className="btn ghost btn-compact">Sign Out</button>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 400, margin: '2rem auto' }}>
        <h2>Admin Login</h2>
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="btn block"
          style={{ marginBottom: 8 }}
        >
          Sign in with Google
        </button>
        {authError && <div style={{ color: 'red', marginTop: 8 }}>{authError}</div>}
      </div>
    );
  }

  const galleryFull = galleryCount >= GALLERY_LIMIT;
  const galleryCheckboxDisabled = galleryFull && !editingWasGalleryFeatured;
  const galleryWarningActive = galleryCheckboxDisabled;
  const galleryStatusText = `${galleryCount}/${GALLERY_LIMIT} gallery slots used`;
  const galleryWarningText = `Gallery is full (${galleryCount}/${GALLERY_LIMIT}). Unfeature another piece before adding another.`;

  return (
    <>
      <div style={{ maxWidth: 800, margin: '2rem auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Admin</h2>
          <button type="button" onClick={handleLogout} className="btn ghost btn-compact">Sign Out</button>
        </div>
        <div className="admin-mode-buttons">
          {[
            { key: 'orders', label: 'Check orders' },
            { key: 'inventory', label: 'Update stock' },
            { key: 'projects', label: 'Manage projects' },
            { key: 'site', label: 'Edit site' },
          ].map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => setMode(option.key)}
              className={`btn admin-mode-button ${mode === option.key ? 'is-active' : 'ghost'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'orders' && (
        <div style={{ maxWidth: 1000, margin: '0 auto 2rem' }}>
          <h3 style={{ marginBottom: 8 }}>Orders</h3>
          <OrdersTable 
            orders={orders} 
            loading={ordersLoading} 
            error={ordersError}
            onOrdersChange={setOrders}
            onLoadingChange={setOrdersLoading}
            onErrorChange={setOrdersError}
          />
        </div>
      )}

      {mode === 'inventory' && (
  <div style={{ width: '100%', maxWidth: 'min(1100px, 96vw)', margin: '2rem auto' }}>
          <h2>{editId ? 'Edit' : 'Add New'} Item</h2>
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 12,
            background: 'var(--surface)'
          }}>
            <div style={{fontSize: 13, color: 'var(--muted)'}}>Signed in as</div>
            <div style={{fontWeight: 600}}>{user?.email || '—'}</div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="admin-form-grid">
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
              <input
                type="number"
                placeholder="Price (£)"
                value={price}
                onChange={e => setPrice(e.target.value)}
                required
              />
              <input
                type="number"
                placeholder="Delivery cost (£)"
                value={deliveryCost}
                onChange={e => setDeliveryCost(e.target.value)}
              />
              <input
                type="text"
                placeholder="Item type (e.g. Bowl, Pen, Clock)"
                value={itemType}
                onChange={e => setItemType(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Material (e.g. Walnut, Mild Steel)"
                value={material}
                onChange={e => setMaterial(e.target.value)}
                required
              />
              <div className="admin-materials-row">
                <input
                  type="text"
                  placeholder="Materials (detailed notes)"
                  value={materials}
                  onChange={e => setMaterials(e.target.value)}
                />
              </div>
              {customizable && (
                <input
                  type="text"
                  placeholder="Available materials (comma-separated, e.g. Steel, Brass, Copper)"
                  value={availableMaterials}
                  onChange={e => setAvailableMaterials(e.target.value)}
                  className="available-materials-positioned"
                />
              )}
              <div className="admin-checkboxes-positioned">
                <div className="admin-checkbox-group">
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={customizable}
                      onChange={e => setCustomizable(e.target.checked)}
                    />
                    <span className="admin-checkbox__text">Customizable</span>
                  </label>
                  <label className={`admin-checkbox${galleryCheckboxDisabled ? ' is-disabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={galleryFeatured}
                      disabled={galleryCheckboxDisabled}
                      onChange={e => setGalleryFeatured(e.target.checked)}
                    />
                    <span className="admin-checkbox__text">In Gallery</span>
                  </label>
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={published}
                      onChange={e => setPublished(e.target.checked)}
                    />
                    <span className="admin-checkbox__text">Published</span>
                  </label>
                </div>
              </div>
              <textarea
                placeholder="Description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
                className="field-full"
                rows={4}
              />
            </div>
            {existingImages.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <strong>Existing images:</strong>
                <ul style={{ paddingLeft: 16 }}>
                  {existingImages.map((url, i) => {
                    const isCover = coverImage === url;
                    return (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img src={url} alt="existing" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }} />
                        {isCover ? (
                          <span className="badge-wood">Cover</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCoverImage(url)}
                            className="btn ghost btn-xs"
                            style={{ marginRight: 4 }}
                          >
                            Set as cover
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveExistingImage(url)}
                          className="btn danger btn-xs"
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 8 }}>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
              />
              <div className={`admin-gallery-note${galleryWarningActive ? ' is-error' : ''}`}>
                {galleryWarningActive ? galleryWarningText : galleryStatusText}
              </div>
            </div>
            {images.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <strong>Selected images:</strong>
                <ul style={{ paddingLeft: 16 }}>
                  {images.map((img, i) => <li key={i}>{img.name}</li>)}
                </ul>
              </div>
            )}
            <button type="submit" disabled={uploading} className="btn block">
              {uploading ? (editId ? 'Saving...' : 'Uploading...') : (editId ? 'Save Changes' : 'Add Item')}
            </button>
            {editId && (
              <button
                type="button"
                onClick={() => {
                setEditId(null);
                setName('');
                setDescription('');
                setPrice('');
                setDeliveryCost('');
                setImages([]);
                setExistingImages([]);
                setMaterials('');
                setMaterial('');
                setItemType('');
                setCoverImage('');
                setCustomizable(false);
                setGalleryFeatured(false);
                setEditingWasGalleryFeatured(false);
                }}
                className="btn ghost block"
                style={{ marginTop: 8 }}
              >
                Cancel Edit
              </button>
            )}
          </form>
          {success && <div style={{ color: 'green', marginTop: 8 }}>Upload successful!</div>}
          {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
          <hr style={{ margin: '2rem 0' }} />
          <h3>Existing Items</h3>
          {loading ? <div>Loading...</div> : (
            <div className="admin-items-grid">
              {items.map(item => (
                <div key={item.id} className="admin-item-card" style={{
                  border: '1px solid #353634',
                  borderRadius: 12,
                  padding: 16,
                  background: 'var(--surface)',
                  boxShadow: '0 2px 8px 0 rgba(40,30,20,0.08)',
                  minHeight: 180,
                }}>
                  <strong>{item.name}</strong><br />
                  {item.images && item.images[0] && (
                    <img
                      src={item.images[0]}
                      alt={item.name}
                      className="admin-item-card__image"
                    />
                  )}
                  <br />
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    <div><strong>Material:</strong> {item.material || item.materials || '—'}</div>
                    <div><strong>Item type:</strong> {item.itemType || '—'}</div>
                  </div>
                  <div className="divider" style={{ margin: '0.8rem 0' }} />
                  <div style={{ display:'flex', alignItems:'center', gap:8, margin:'6px 0' }}>
                    <label style={{ fontSize:12, color:'var(--muted)' }}>Stock:</label>
                    <input type="number" value={Number(item.stock ?? 0)} onChange={e => {
                      const v = parseInt(e.target.value || '0', 10);
                      setItems(prev => prev.map(it => it.id === item.id ? { ...it, stock: v } : it));
                    }} style={{ width:80 }} />
                    <button
                      type="button"
                      className="btn btn-xs ghost"
                      onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'furniture', item.id), { stock: Number(item.stock ?? 0) });
                      } catch (err) {
                        alert('Failed to save stock: ' + (err?.message || 'unknown'))
                      }
                      }}
                    >
                      Save
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEdit(item)}
                    className="btn ghost btn-xs"
                    style={{ marginRight: 8, marginBottom: 6 }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="btn danger btn-xs"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'projects' && (
        <div style={{ width: '100%', maxWidth: 'min(1100px, 96vw)', margin: '2rem auto' }}>
          <h2>{projectEditId ? 'Edit' : 'Add New'} Project</h2>
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 12,
            background: 'var(--surface)'
          }}>
            <div style={{fontSize: 13, color: 'var(--muted)'}}>Signed in as</div>
            <div style={{fontWeight: 600}}>{user?.email || '—'}</div>
          </div>
          <form onSubmit={handleProjectSubmit}>
            <div className="admin-form-grid">
              <input
                type="text"
                placeholder="Project title"
                value={projectTitle}
                onChange={e => setProjectTitle(e.target.value)}
                required
              />
              <div className="field-full">
                <label>Images</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleProjectImageChange}
                />
              </div>
            </div>
            {projectExistingImages.length > 0 && (
              <div className="field-full">
                <label>Existing Images</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {projectExistingImages.map((url, idx) => (
                    <div key={url} style={{ position: 'relative' }}>
                      <img src={url} alt={`Existing ${idx + 1}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }} />
                      <button
                        type="button"
                        onClick={() => handleRemoveProjectExistingImage(url)}
                        style={{ position: 'absolute', top: -4, right: -4, background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer' }}
                      >
                        ×
                      </button>
                      <input
                        type="radio"
                        name="mainImage"
                        value={url}
                        checked={projectMainImage === url}
                        onChange={() => setProjectMainImage(url)}
                        style={{ position: 'absolute', bottom: 4, left: 4 }}
                      />
                      <label style={{ position: 'absolute', bottom: 4, left: 20, fontSize: 12, color: 'white', background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: 2 }}>Main</label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {projectImages.length > 0 && (
              <div className="field-full">
                <label>New Images</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {projectImages.map((file, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img src={URL.createObjectURL(file)} alt={`New ${idx + 1}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }} />
                      <button
                        type="button"
                        onClick={() => setProjectImages(prev => prev.filter((_, i) => i !== idx))}
                        style={{ position: 'absolute', top: -4, right: -4, background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer' }}
                      >
                        ×
                      </button>
                      <input
                        type="radio"
                        name="mainImage"
                        value={`new-${idx}`}
                        checked={projectMainImage === `new-${idx}`}
                        onChange={() => setProjectMainImage(`new-${idx}`)}
                        style={{ position: 'absolute', bottom: 4, left: 4 }}
                      />
                      <label style={{ position: 'absolute', bottom: 4, left: 20, fontSize: 12, color: 'white', background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: 2 }}>Main</label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button type="submit" className="btn block" disabled={uploading}>
              {uploading ? (projectEditId ? 'Saving...' : 'Uploading...') : (projectEditId ? 'Save Changes' : 'Add Project')}
            </button>
            {projectEditId && (
              <button
                type="button"
                onClick={() => {
                  setProjectEditId(null)
                  setProjectTitle('')
                  setProjectImages([])
                  setProjectExistingImages([])
                  setProjectMainImage('')
                }}
                className="btn ghost block"
                style={{ marginTop: 8 }}
              >
                Cancel Edit
              </button>
            )}
          </form>
          {success && <div style={{ color: 'green', marginTop: 8 }}>Upload successful!</div>}
          {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
          <hr style={{ margin: '2rem 0' }} />
          <h3>Existing Projects</h3>
          {projectsLoading ? <div>Loading...</div> : projectsError ? <div style={{ color: 'red' }}>{projectsError}</div> : (
            <div className="admin-items-grid">
              {projects.map(project => (
                <div key={project.id} className="admin-item-card" style={{
                  border: '1px solid #353634',
                  borderRadius: 12,
                  padding: 16,
                  background: 'var(--surface)',
                  boxShadow: '0 2px 8px 0 rgba(40,30,20,0.08)',
                  minHeight: 180,
                }}>
                  <strong>{project.title}</strong><br />
                  {project.mainImage && (
                    <img
                      src={project.mainImage}
                      alt={project.title}
                      className="admin-item-card__image"
                    />
                  )}
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    <div><strong>Images:</strong> {project.images?.length || 0}</div>
                  </div>
                  <div className="divider" style={{ margin: '0.8rem 0' }} />
                  <button
                    type="button"
                    onClick={() => handleProjectEdit(project)}
                    className="btn ghost btn-xs"
                    style={{ marginRight: 8, marginBottom: 6 }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProjectDelete(project.id)}
                    className="btn danger btn-xs"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'site' && (
  <div style={{ width: '100%', maxWidth: 'min(1100px, 96vw)', margin: '2rem auto' }}>
          <section className="card" style={{ marginBottom: 16 }}>
            <h3 className="h3">Site visibility controls</h3>
            <p className="muted" style={{ marginTop: 0 }}>Toggle the artists directory and artist profiles without redeploying.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['artistsEnabled', 'artistPagesEnabled', 'shopEnabled'].map((flag) => {
                const label = flag === 'artistsEnabled' ? 'Artists directory' : flag === 'artistPagesEnabled' ? 'Artist profile pages' : 'Shop'
                const enabled = siteConfig?.[flag] ?? DEFAULT_SITE_VISIBILITY[flag]
                const loadingFlag = toggleLoading[flag]
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => handleVisibilityToggle(flag)}
                    disabled={siteConfigLoading || loadingFlag}
                    className="btn btn-compact"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {loadingFlag
                      ? 'Updating…'
                      : `${enabled ? 'Hide' : 'Show'} ${label}`}
                  </button>
                )
              })}
            </div>
            {toggleMessage && <p className="muted" style={{ marginTop: 10 }}>{toggleMessage}</p>}
            {toggleError && <p style={{ color: '#dc2626', marginTop: 4 }}>{toggleError}</p>}
          </section>
        </div>
      )}
    </>
  );
}

function formatOrderDate(value) {
  if (!value) return '';
  const date = value.toDate ? value.toDate() : (value instanceof Date ? value : new Date(value));
  if (!date || Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day}/${month}/${year} ${time}`;
}

function OrdersTable({ orders, loading, error, onOrdersChange, onLoadingChange, onErrorChange }) {
  const [downloading, setDownloading] = useState(false);

  const exportCsv = async () => {
    if (!orders || orders.length === 0) return;

    setDownloading(true);
    try {
      // Prepare CSV headers
      const headers = ['Created', 'Status', 'Amount', 'Currency', 'Customer Name', 'Customer Email', 'Items Summary', 'Receipt URL'];

      // Prepare CSV rows
      const rows = orders.map(order => [
        formatOrderDate(order.created),
        order.status || '',
        typeof order.amount === 'number' ? (order.amount / 100).toFixed(2) : '',
        order.currency || '',
        order.customer?.name || '',
        order.customer?.email || '',
        order.itemsSummary || '',
        order.squareReceiptUrl || ''
      ]);

      // Combine headers and rows
      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('CSV export failed:', err);
      alert('Failed to export CSV');
    }
    setDownloading(false);
  };

  const restoreInventoryForOrder = async (items) => {
    if (!Array.isArray(items) || items.length === 0) return;
    for (const line of items) {
      try {
        const productId = String(line && line.productId);
        const qty = Number(line && line.qty);
        if (!productId || !Number.isInteger(qty) || qty <= 0) continue;
        const ref = doc(db, 'furniture', productId);
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) return;
          const data = snap.data() || {};
          if (typeof data.stock === 'number') {
            const next = data.stock + qty;
            tx.update(ref, { stock: next });
          }
        });
        console.log('[Admin] Restored stock for', productId, 'qty', qty);
      } catch (err) {
        console.error('[Admin] Failed to restore stock for', line && line.productId, err);
      }
    }
  };

  const cleanupOldOrders = async () => {
    try {
      onLoadingChange(true);
      onErrorChange('');

      const q = query(collection(db, 'orders'), orderBy('created', 'desc'));
      const snap = await getDocs(q);
      const allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const ordersToDelete = allOrders.filter(order => order.status === 'PENDING');

      console.log(`[Admin] Found ${allOrders.length} total orders`);
      console.log(`[Admin] Orders by status:`, allOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {}));
      console.log(`[Admin] Found ${ordersToDelete.length} PENDING orders to delete`);

      if (ordersToDelete.length === 0) {
        alert('No pending orders to clean up.');
        onLoadingChange(false);
        return;
      }

      const confirmDelete = window.confirm(`Delete ${ordersToDelete.length} pending orders?`);
      if (!confirmDelete) {
        onLoadingChange(false);
        return;
      }

      console.log(`[Admin] Deleting ${ordersToDelete.length} pending orders...`);
      let deletedCount = 0;

      for (const order of ordersToDelete) {
        try {
          // Restore inventory before deleting the order
          if (order.items && Array.isArray(order.items)) {
            await restoreInventoryForOrder(order.items);
          }
          await deleteDoc(doc(db, 'orders', order.id));
          console.log(`[Admin] Deleted pending order: ${order.id}`);
          deletedCount++;
        } catch (deleteErr) {
          console.error(`[Admin] Failed to delete order ${order.id}:`, deleteErr);
        }
      }

      alert(`Successfully deleted ${deletedCount} pending orders.`);

      // Refetch orders
      const freshSnap = await getDocs(q);
      const freshList = freshSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      onOrdersChange(freshList);

    } catch (err) {
      console.error('[Admin] Cleanup error:', err);
      onErrorChange('Cleanup failed: ' + (err?.message || 'unknown'));
    }
    onLoadingChange(false);
  };

  if (loading) return <div>Loading orders…</div>;
  if (error) return <div style={{ color:'red' }}>{error}</div>;
  if (!orders || orders.length === 0) return <div>No orders yet.</div>;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{fontSize:12, color:'var(--muted)'}}>Total: {orders.length}</div>
        <div style={{ display:'flex', gap:8 }}>
          <button
            type="button"
            onClick={cleanupOldOrders}
            disabled={loading}
            className="btn ghost btn-compact"
          >
            Clean Up Old Orders
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={downloading}
            className="btn ghost btn-compact"
          >
            Export CSV
          </button>
        </div>
      </div>
      <div style={{ 
        overflowX:'auto', 
        overflowY: 'auto', 
        maxHeight: '50vh', 
        border: '1px solid var(--border)', 
        borderRadius: '8px', 
        padding: '16px',
        backgroundColor: 'var(--surface-2)'
      }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ textAlign:'left', borderBottom:'1px solid var(--border)' }}>
              <th>Created</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Customer</th>
              <th>Email</th>
              <th>Items</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={{ borderBottom:'1px solid var(--border)' }}>
                <td>{formatOrderDate(o.created)}</td>
                <td>{o.status}</td>
                <td>{typeof o.amount === 'number' ? `£${(o.amount/100).toFixed(2)}` : ''} {o.currency}</td>
                <td>{o.customer?.name || '—'}</td>
                <td>{o.customer?.email || '—'}</td>
                <td style={{ maxWidth:320, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{o.itemsSummary || ''}</td>
                <td>{o.squareReceiptUrl ? <a href={o.squareReceiptUrl} target="_blank" rel="noreferrer">Receipt</a> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
