import React, { useState } from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc, Timestamp, getDocs, deleteDoc, doc, updateDoc, setDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getAuth, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from 'firebase/auth';
import { useSiteConfig } from '../context/SiteConfigContext.jsx';
import { DEFAULT_SITE_VISIBILITY, SITE_VISIBILITY_DOC } from '../config/siteVisibility.js';

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
  const [published, setPublished] = useState(false);
  const [editId, setEditId] = useState(null);
  const [existingImages, setExistingImages] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]);
  // Admin mode: 'orders' or 'inventory'
  const [mode, setMode] = useState('orders');
  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
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
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setOrders(list);
      } catch (err) {
        console.error('[Admin] Orders fetch error:', err);
        setOrdersError('Failed to load orders: ' + (err?.message || 'unknown'));
      }
      setOrdersLoading(false);
    }
    if (user && mode === 'orders') fetchOrders();
  }, [user, mode, success]);

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
    setPublished(!!item.published);
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
      const pricePence = Math.round(parseFloat(price) * 100);
      const data = {
        name,
        description,
        price: pricePence,
        images: imageUrls,
        materials,
        craftsmanship,
        customizable,
        published,
        created: editId ? undefined : Timestamp.now(),
      };
      if (editId) {
        // Remove undefined fields
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
        console.log('[Admin] Updating doc:', editId);
        await updateDoc(doc(db, 'furniture', editId), data);
        console.log('[Admin] Update succeeded');
        setEditId(null);
      } else {
        console.log('[Admin] Creating new doc with data:', data);
        const docRef = await addDoc(collection(db, 'furniture'), data);
        console.log('[Admin] Doc created with ID:', docRef.id);
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
      setPublished(false);
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
    } catch (err) {
      setError('Delete failed: ' + err.message);
    }
  };

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
      <div style={{ maxWidth: 800, margin: '2rem auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Admin</h2>
          <button onClick={handleLogout}>Sign Out</button>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          {[
            { key: 'orders', label: 'Check orders' },
            { key: 'inventory', label: 'Update stock' },
            { key: 'site', label: 'Edit site' },
          ].map(option => (
            <button
              key={option.key}
              onClick={() => setMode(option.key)}
              className={mode === option.key ? 'btn' : ''}
              style={{
                padding:'8px 12px',
                borderRadius:8,
                border:'1px solid var(--border)',
                background: mode===option.key ? 'var(--primary)' : 'var(--surface)',
                color: mode===option.key ? 'white' : 'var(--text)',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'orders' && (
        <div style={{ maxWidth: 1000, margin: '0 auto 2rem' }}>
          <h3 style={{ marginBottom: 8 }}>Orders</h3>
          <OrdersTable orders={orders} loading={ordersLoading} error={ordersError} />
        </div>
      )}

      {mode === 'inventory' && (
        <div style={{ maxWidth: 650, margin: '2rem auto' }}>
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
            <div style={{fontSize: 13}}>UID: <code>{user?.uid || '—'}</code></div>
            <div style={{fontSize: 13}}>Email verified: {String(!!user?.emailVerified)}</div>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(user?.uid || ''); }} style={{marginTop: 6}}>Copy UID</button>
            <div style={{fontSize: 12, color:'#b45309', marginTop: 6}}>
              If you can't see items or save changes, add this UID to Firestore/Storage rules or use an admins collection.
            </div>
          </div>
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
            <label style={{ display: 'block', marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={published}
                onChange={e => setPublished(e.target.checked)}
                style={{ marginRight: 8 }}
              />
              Published (visible in the shop)
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
                  <div style={{ display:'flex', alignItems:'center', gap:8, margin:'6px 0' }}>
                    <label style={{ fontSize:12, color:'var(--muted)' }}>Stock:</label>
                    <input type="number" value={Number(item.stock ?? 0)} onChange={e => {
                      const v = parseInt(e.target.value || '0', 10);
                      setItems(prev => prev.map(it => it.id === item.id ? { ...it, stock: v } : it));
                    }} style={{ width:80 }} />
                    <button onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'furniture', item.id), { stock: Number(item.stock ?? 0) });
                      } catch (err) {
                        alert('Failed to save stock: ' + (err?.message || 'unknown'))
                      }
                    }}>Save</button>
                  </div>
                  <button onClick={() => handleEdit(item)} style={{ marginRight: 8, marginBottom: 6 }}>Edit</button>
                  <button onClick={() => handleDelete(item.id)} style={{ color: 'red', marginTop: 0 }}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'site' && (
        <div style={{ maxWidth: 650, margin: '2rem auto' }}>
          <section className="card" style={{ marginBottom: 16 }}>
            <h3 className="h3">Site visibility controls</h3>
            <p className="muted" style={{ marginTop: 0 }}>Toggle the artists directory and artist profiles without redeploying.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['artistsEnabled', 'artistPagesEnabled'].map((flag) => {
                const label = flag === 'artistsEnabled' ? 'Artists directory' : 'Artist profile pages'
                const enabled = siteConfig?.[flag] ?? DEFAULT_SITE_VISIBILITY[flag]
                const loadingFlag = toggleLoading[flag]
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => handleVisibilityToggle(flag)}
                    disabled={siteConfigLoading || loadingFlag}
                    className="btn"
                    style={{
                      alignSelf: 'flex-start',
                      opacity: siteConfigLoading ? 0.6 : 1,
                      pointerEvents: siteConfigLoading ? 'none' : undefined,
                    }}
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

function OrdersTable({ orders, loading, error }) {
  const [downloading, setDownloading] = useState(false);

  const exportCsv = () => {
    try {
      setDownloading(true);
      const header = [
        'id','amount','currency','status','created','customer.name','customer.email','customer.address','customer.city','customer.postcode','customer.countryCode','receiptUrl'
      ];
      const rows = orders.map(o => [
        o.id,
        o.amount,
        o.currency,
        o.status,
        o.created && o.created.toDate ? o.created.toDate().toISOString() : '',
        o.customer?.name || '',
        o.customer?.email || '',
        o.customer?.address || '',
        o.customer?.city || '',
        o.customer?.postcode || '',
        o.customer?.countryCode || '',
        o.squareReceiptUrl || ''
      ]);
      const csv = [header, ...rows].map(r => r.map(cell => {
        const s = String(cell ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      }).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div>Loading orders…</div>;
  if (error) return <div style={{ color:'red' }}>{error}</div>;
  if (!orders || orders.length === 0) return <div>No orders yet.</div>;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{fontSize:12, color:'var(--muted)'}}>Total: {orders.length}</div>
        <button onClick={exportCsv} disabled={downloading}>Export CSV</button>
      </div>
      <div style={{ overflowX:'auto' }}>
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
                <td>{o.created && o.created.toDate ? o.created.toDate().toLocaleString() : ''}</td>
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
