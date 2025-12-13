// Google Sheets Configuration
// Replace these URLs with your published Google Sheets URLs
// See GOOGLE_SHEETS_SETUP.md for instructions
const GOOGLE_SHEETS_CONFIG = {
    shows: 'https://script.google.com/macros/s/AKfycbyGv4JnXoAHl-K7lisa5k0gBD81__IxnS9lr5KobetcYxaVBxlQzujjA_UH4QeReHfEEg/exec', // Your shows sheet URL here
    inventory: 'https://script.google.com/macros/s/AKfycbyxwrF8oflK4EU_XeiZY4jomnJEOWCm2lcEGwZVjQZ1hZ81OXUzSYrnB79b44quVRUf/exec' // Your inventory sheet URL here
};

// Mobile Menu Toggle
const menuToggle = document.querySelector('.menu-toggle');
const navMenu = document.querySelector('.nav-menu');

menuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
});

// Close menu when clicking on a link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
    });
});

// Smooth Scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Schedule Management
let schedules = [];

// Check if data should be refreshed (24 hours or first load)
function shouldRefreshData(dataType) {
    const lastRefreshKey = `lastRefresh_${dataType}`;
    const lastRefresh = localStorage.getItem(lastRefreshKey);
    
    if (!lastRefresh) {
        // First time loading
        return true;
    }
    
    const lastRefreshTime = parseInt(lastRefresh);
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    return (now - lastRefreshTime) >= twentyFourHours;
}

// Save refresh timestamp
function saveRefreshTime(dataType) {
    const lastRefreshKey = `lastRefresh_${dataType}`;
    localStorage.setItem(lastRefreshKey, Date.now().toString());
}

// Load schedules from Google Sheets
async function loadSchedulesFromSheet(forceRefresh = false) {
    if (!GOOGLE_SHEETS_CONFIG.shows) {
        // If no sheet URL configured, show loading message
        showLoadingSchedules();
        return;
    }
    
    // Check if we need to refresh (skip check if forceRefresh is true)
    if (!forceRefresh && !shouldRefreshData('schedules')) {
        // Use cached data if available
        const cached = localStorage.getItem('cached_schedules');
        if (cached) {
            try {
                schedules = JSON.parse(cached);
                renderSchedules();
                return;
            } catch (e) {
                // If cache is invalid, continue to fetch
            }
        }
    }
    
    // Show loading message while fetching
    showLoadingSchedules();
    
    try {
        const response = await fetch(GOOGLE_SHEETS_CONFIG.shows);
        const data = await response.json();
        
        // Convert sheet data to schedule format
        schedules = data
            .filter(row => row.day && row.title) // Filter out empty rows
            .map(row => ({
                day: parseInt(row.day) || row.day,
                month: (row.month || '').toUpperCase(),
                title: row.title || '',
                location: row.location || '',
                time: row.time || ''
            }));
        
        // Cache the data
        localStorage.setItem('cached_schedules', JSON.stringify(schedules));
        saveRefreshTime('schedules');
        
        renderSchedules();
    } catch (error) {
        console.error('Error loading schedules from sheet:', error);
        // Try to use cached data if fetch fails
        const cached = localStorage.getItem('cached_schedules');
        if (cached) {
            try {
                schedules = JSON.parse(cached);
                renderSchedules();
                return;
            } catch (e) {
                // Cache is invalid, show error
            }
        }
        // Show error message if sheet fails to load
        showErrorSchedules();
    }
}

function showLoadingSchedules() {
    const scheduleGrid = document.getElementById('scheduleGrid');
    if (!scheduleGrid) return;
    scheduleGrid.innerHTML = '<div class="schedule-loading" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--dark-brown); font-size: 1.3rem; font-weight: 600;">Loading schedule...</div>';
}

function showErrorSchedules() {
    const scheduleGrid = document.getElementById('scheduleGrid');
    if (!scheduleGrid) return;
    scheduleGrid.innerHTML = '<div class="schedule-error" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--gray); font-size: 1.2rem;">Unable to load schedule. Please try again later.</div>';
}

function renderSchedules() {
    const scheduleGrid = document.getElementById('scheduleGrid');
    if (!scheduleGrid) return;
    
    if (schedules.length === 0) {
        showLoadingSchedules();
        return;
    }
    
    scheduleGrid.innerHTML = schedules.map(schedule => `
        <div class="schedule-item">
            <div class="schedule-date">
                <span class="date-day">${schedule.day}</span>
                <span class="date-month">${schedule.month}</span>
            </div>
            <div class="schedule-details">
                <h3>${schedule.title}</h3>
                <p class="schedule-location">📍 ${schedule.location}</p>
                <p class="schedule-time">🕐 ${schedule.time}</p>
            </div>
        </div>
    `).join('');
}


// Inventory Management
let inventory = [];
let displayedCount = 9; // Number of items to show initially
const itemsPerPage = 9; // Number of items to load per "Load More" click

// Load inventory from Google Sheets
async function loadInventoryFromSheet(forceRefresh = false) {
    if (!GOOGLE_SHEETS_CONFIG.inventory) {
        // If no sheet URL configured, show loading message
        showLoadingInventory();
        return;
    }
    
    // Check if we need to refresh (skip check if forceRefresh is true)
    if (!forceRefresh && !shouldRefreshData('inventory')) {
        // Use cached data if available
        const cached = localStorage.getItem('cached_inventory');
        if (cached) {
            try {
                inventory = JSON.parse(cached);
                renderInventory();
                return;
            } catch (e) {
                // If cache is invalid, continue to fetch
            }
        }
    }
    
    // Show loading message while fetching
    showLoadingInventory();
    
    try {
        const response = await fetch(GOOGLE_SHEETS_CONFIG.inventory);
        
        // Check if response is ok
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Check content type
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Expected JSON but got:', contentType);
            console.error('Response text:', text.substring(0, 200));
            throw new Error('Invalid response format from sheet');
        }
        
        const data = await response.json();
        
        // Check if data is valid
        if (!Array.isArray(data)) {
            console.error('Data is not an array:', data);
            throw new Error('Invalid data format from sheet - expected array');
        }
        
        // Convert sheet data to inventory format
        inventory = data
            .filter(row => row.name && row.category) // Filter out empty rows
            .map(row => {
                // Convert price to string and ensure it starts with $
                let price = String(row.price || '').trim();
                if (price && !price.startsWith('$')) {
                    price = '$' + price;
                }
                return {
                    category: (row.category || '').toLowerCase(),
                    name: row.name || '',
                    price: price,
                    image: row.image || row.imageurl || '' // Support both 'image' and 'imageurl' column names
                };
            });
        
        // Cache the data
        localStorage.setItem('cached_inventory', JSON.stringify(inventory));
        saveRefreshTime('inventory');
        
        renderInventory();
    } catch (error) {
        console.error('Error loading inventory from sheet:', error);
        console.error('Sheet URL:', GOOGLE_SHEETS_CONFIG.inventory);
        // Try to use cached data if fetch fails
        const cached = localStorage.getItem('cached_inventory');
        if (cached) {
            try {
                inventory = JSON.parse(cached);
                renderInventory();
                return;
            } catch (e) {
                // Cache is invalid, show error
            }
        }
        // Show error message if sheet fails to load
        showErrorInventory();
    }
}

function showLoadingInventory() {
    const inventoryGrid = document.getElementById('inventoryGrid');
    if (!inventoryGrid) return;
    inventoryGrid.innerHTML = '<div class="inventory-loading" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--dark-brown); font-size: 1.3rem; font-weight: 600;">Loading inventory...</div>';
}

function showErrorInventory() {
    const inventoryGrid = document.getElementById('inventoryGrid');
    if (!inventoryGrid) return;
    inventoryGrid.innerHTML = `
        <div class="inventory-error" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--gray); font-size: 1.2rem;">
            Unable to load inventory. Please try again later.<br>
            <small style="font-size: 0.9rem; margin-top: 1rem; display: block;">Check the browser console (F12) for more details.</small>
        </div>
    `;
}

function renderInventory(filter = 'all', searchTerm = '', resetCount = true) {
    const inventoryGrid = document.getElementById('inventoryGrid');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    if (!inventoryGrid) return;
    
    if (inventory.length === 0) {
        showLoadingInventory();
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';
        return;
    }
    
    // Reset displayed count when filter or search changes
    if (resetCount) {
        displayedCount = itemsPerPage;
    }
    
    // Apply category filter
    let filtered = filter === 'all' 
        ? inventory 
        : inventory.filter(item => item.category === filter);
    
    // Apply search filter
    if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filtered = filtered.filter(item => 
            item.name.toLowerCase().includes(searchLower) ||
            item.price.toLowerCase().includes(searchLower)
        );
    }
    
    if (filtered.length === 0) {
        inventoryGrid.innerHTML = '<div class="inventory-empty" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--gray); font-size: 1.2rem;">No items found.</div>';
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';
        return;
    }
    
    // Get items to display (pagination)
    const itemsToShow = filtered.slice(0, displayedCount);
    
    inventoryGrid.innerHTML = itemsToShow.map(item => `
        <div class="inventory-item" data-category="${item.category}">
            <div class="inventory-image">
                ${item.image ? `<img src="${item.image}" alt="${item.name}" onerror="this.style.display='none'; this.parentElement.innerHTML='📦';" />` : '📦'}
            </div>
            <h3>${item.name}</h3>
            <p class="inventory-price">${item.price}</p>
        </div>
    `).join('');
    
    // Show/hide "Load More" button
    if (loadMoreContainer) {
        if (displayedCount < filtered.length) {
            loadMoreContainer.style.display = 'block';
        } else {
            loadMoreContainer.style.display = 'none';
        }
    }
}

// Inventory Filters (set up in DOMContentLoaded)


// Contact Form
document.getElementById('contactForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        message: document.getElementById('message').value
    };
    
    // In a real application, you would send this to a server
    alert('Thank you for your message! We\'ll get back to you soon.');
    document.getElementById('contactForm').reset();
});

// Instagram Feed Integration
const INSTAGRAM_USERNAME = 'ollies.dice';

// Instagram post URLs to embed (add your recent post URLs here)
// To get a post URL: Open the post on Instagram, click the three dots, select "Copy link"
// You can also add your profile URL to show a profile embed
const INSTAGRAM_POST_URLS = [
    'https://www.instagram.com/ollies.dice/', // Profile URL
    // Add individual post URLs here, for example:
    // 'https://www.instagram.com/p/ABC123xyz/',
    // 'https://www.instagram.com/p/DEF456uvw/',
];

async function fetchInstagramFeed() {
    const feedContainer = document.getElementById('instagramFeed');
    
    // If no post URLs configured, show placeholder
    if (!INSTAGRAM_POST_URLS || INSTAGRAM_POST_URLS.length === 0) {
        feedContainer.innerHTML = `
            <div class="instagram-placeholder">
                <p>📸 Follow us on Instagram!</p>
                <p class="placeholder-note">
                    Add Instagram post URLs to script.js to display your latest posts here.
                </p>
                <p style="margin-top: 1rem;">
                    <a href="https://instagram.com/${INSTAGRAM_USERNAME}" target="_blank" 
                       style="color: var(--dark-brown); text-decoration: underline;">
                       Visit our Instagram page →
                    </a>
                </p>
            </div>
        `;
        return;
    }
    
    // Fetch embed codes for each post URL
    feedContainer.innerHTML = '<div class="instagram-loading" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--dark-brown); font-size: 1.2rem;">Loading Instagram posts...</div>';
    
    try {
        const embedPromises = INSTAGRAM_POST_URLS.map(async (postUrl) => {
            try {
                // Check if it's a profile URL (ends with / and no /p/ in it)
                const isProfileUrl = postUrl.includes('instagram.com/') && 
                                   !postUrl.includes('/p/') && 
                                   !postUrl.includes('/reel/') &&
                                   postUrl.endsWith('/');
                
                if (isProfileUrl) {
                    // For profile URLs, create a profile embed using Instagram's embed.js
                    // Instagram doesn't support oEmbed for profiles, so we'll use an iframe
                    return `<div class="instagram-profile-embed">
                        <iframe src="https://www.instagram.com/${INSTAGRAM_USERNAME}/embed/" 
                                width="100%" 
                                height="600" 
                                frameborder="0" 
                                scrolling="no" 
                                allowtransparency="true"
                                style="border-radius: 15px; max-width: 100%;"></iframe>
                    </div>`;
                }
                
                // Use Instagram oEmbed API for individual posts
                const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}&omitscript=true`;
                const response = await fetch(oembedUrl);
                
                if (!response.ok) {
                    console.warn(`Failed to fetch embed for ${postUrl}`);
                    return null;
                }
                
                const data = await response.json();
                return data.html;
            } catch (error) {
                console.warn(`Error fetching embed for ${postUrl}:`, error);
                return null;
            }
        });
        
        const embeds = await Promise.all(embedPromises);
        const validEmbeds = embeds.filter(embed => embed !== null);
        
        if (validEmbeds.length === 0) {
            feedContainer.innerHTML = `
                <div class="instagram-placeholder">
                    <p>📸 Unable to load Instagram posts</p>
                    <p class="placeholder-note">
                        <a href="https://instagram.com/${INSTAGRAM_USERNAME}" target="_blank" 
                           style="color: var(--dark-brown); text-decoration: underline;">
                           Visit our Instagram page →
                        </a>
                    </p>
                </div>
            `;
            return;
        }
        
        // Display embedded posts
        feedContainer.innerHTML = validEmbeds.map(embed => `
            <div class="instagram-post">
                ${embed}
            </div>
        `).join('');
        
        // Load Instagram's embed script if not already loaded
        if (!document.querySelector('script[src*="instagram.com/embed.js"]')) {
            const script = document.createElement('script');
            script.src = 'https://www.instagram.com/embed.js';
            script.async = true;
            document.body.appendChild(script);
        } else {
            // Re-initialize embeds if script already exists
            if (window.instgrm) {
                window.instgrm.Embeds.process();
            }
        }
        
    } catch (error) {
        console.error('Error loading Instagram feed:', error);
        feedContainer.innerHTML = `
            <div class="instagram-placeholder">
                <p>📸 Unable to load Instagram posts</p>
                <p class="placeholder-note">
                    <a href="https://instagram.com/${INSTAGRAM_USERNAME}" target="_blank" 
                       style="color: var(--dark-brown); text-decoration: underline;">
                       Visit our Instagram page →
                    </a>
                </p>
            </div>
        `;
    }
}

// DICE Blocks Mouse Avoidance
function initDiceInteraction() {
    const diceBlocks = document.querySelectorAll('.dice-block');
    const diceContainer = document.querySelector('.dice-container');
    
    if (!diceContainer || diceBlocks.length === 0) return;
    
    let mouseX = 0;
    let mouseY = 0;
    const avoidanceDistance = 120; // Distance at which blocks start moving away
    const maxMoveDistance = 50; // Maximum distance a block can move
    let animationTime = 0;
    
    // Track mouse position
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    
    // Juggle animation offsets (for the floating effect)
    const juggleOffsets = [
        { x: 0, y: 0, rot: -8 },
        { x: 0, y: 0, rot: 5 },
        { x: 0, y: 0, rot: -5 },
        { x: 0, y: 0, rot: 8 }
    ];
    
    // Update block positions based on mouse proximity and juggle animation
    function updateDicePositions() {
        animationTime += 0.012; // Slightly slower animation speed
        
        diceBlocks.forEach((block, index) => {
            const rect = block.getBoundingClientRect();
            const blockCenterX = rect.left + rect.width / 2;
            const blockCenterY = rect.top + rect.height / 2;
            
            // Calculate distance from mouse to block center
            const dx = blockCenterX - mouseX;
            const dy = blockCenterY - mouseY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Mouse avoidance movement
            let avoidX = 0;
            let avoidY = 0;
            if (distance < avoidanceDistance && distance > 0) {
                const force = (avoidanceDistance - distance) / avoidanceDistance;
                avoidX = (dx / distance) * maxMoveDistance * force;
                avoidY = (dy / distance) * maxMoveDistance * force;
            }
            
            // Juggle animation (subtle floating) - slightly slower oscillation
            const jugglePhase = animationTime + (index * 0.2);
            const juggleY = Math.sin(jugglePhase * 1.4) * 25;
            const juggleX = Math.cos(jugglePhase * 0.9) * 5;
            const juggleRot = juggleOffsets[index].rot + Math.sin(jugglePhase * 1.2) * 3;
            
            // Combine both movements
            const totalX = avoidX + juggleX;
            const totalY = avoidY + juggleY;
            
            block.style.transform = `translate(${totalX}px, ${totalY}px) rotate(${juggleRot}deg)`;
        });
        
        requestAnimationFrame(updateDicePositions);
    }
    
    // Start the animation loop
    updateDicePositions();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Load data from Google Sheets (always refresh on page load/refresh)
    loadSchedulesFromSheet(true);
    loadInventoryFromSheet(true);
    fetchInstagramFeed();
    initDiceInteraction();
    
    // Set up inventory filters, search, and load more
    setTimeout(() => {
        // Inventory Filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filter = btn.getAttribute('data-filter');
                const searchTerm = document.getElementById('inventorySearch')?.value || '';
                renderInventory(filter, searchTerm, true);
            });
        });

        // Inventory Search
        const inventorySearchInput = document.getElementById('inventorySearch');
        if (inventorySearchInput) {
            let searchTimeout;
            inventorySearchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const searchTerm = e.target.value;
                    const activeFilter = document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all';
                    renderInventory(activeFilter, searchTerm, true);
                }, 300); // Debounce search by 300ms
            });
        }

        // Load More Button
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                displayedCount += itemsPerPage;
                const activeFilter = document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all';
                const searchTerm = document.getElementById('inventorySearch')?.value || '';
                renderInventory(activeFilter, searchTerm, false);
            });
        }
    }, 100);
    
    // Refresh data every 5 minutes to get updates from sheets (optional - comment out if you don't want auto-refresh)
    // setInterval(() => {
    //     loadSchedulesFromSheet();
    //     loadInventoryFromSheet();
    // }, 300000); // 5 minutes = 300000ms
    
    // Update active nav link on scroll
    const sections = document.querySelectorAll('.section, .hero');
    const navLinks = document.querySelectorAll('.nav-link');
    
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
});

