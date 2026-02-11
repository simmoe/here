var currentPage = '#page1'
var cvData;
var projectsData;
var recommendationsData;
var contactData;
var applicationsData;
var particles = []; // Frontpage animation
var canvasOpacity = 0; // For fade-in animation
var animationStartTime = 0; // Track when animation should start
var projectCategories = [
    { id: 'undervisning', title: 'Undervisning' },
    { id: 'software', title: 'Software' },
    { id: 'kommunikation', title: 'Kommunikation' },
    { id: 'kunst', title: 'Kunst' },
    { id: 'ledelse', title: 'Ledelse' }
];

function preload(){
    cvData = loadJSON('cv.json');
    projectsData = loadJSON('projects.json');
    recommendationsData = loadJSON('recommendations.json');
    contactData = loadJSON('contact.json');
    applicationsData = loadJSON('applications.json');
}

//P5 setup() bliver kaldt EN gang før siden vises 
function setup(){
    console.log('Setup')

    // Initialize Frontpage Animation
    // Use window.innerWidth to ensure correct sizing regardless of p5's initial state
    var canvas = createCanvas(window.innerWidth, window.innerHeight);
    canvas.parent('p5-container');
    
    // Init particles which match CV pearl style (only if not already created)
    if (particles.length === 0) {
        for(let i = 0; i < 50; i++) {
            particles.push(new Particle());
        }
    } else {
        // Reset existing particles (same as menu navigation)
        canvasOpacity = 0;
        animationStartTime = 0;
        particles.forEach(p => {
            p.animationProgress = 0;
            p.pos = createVector(width / 2, height / 2);
        });
    }
    
    // Check for print URL param
    var urlParams = new URLSearchParams(window.location.search);
    var printAppId = urlParams.get('print');
    var printType = urlParams.get('type') || 'full';

    if (printAppId) {
        // Print Mode: Hide everything, show only the specific application
        select('.menu-wrapper').style('display', 'none');
        select('footer').style('display', 'none');
        
        var app = applicationsData.applications.find(a => a.id === printAppId);
        if (app) {
            // Render directly to body or a clean container
            var printContainer = createDiv();
            printContainer.id('print-container');
            printContainer.parent(document.body);
            
            // Hide all pages
            selectAll('.page').forEach(p => p.style('display', 'none'));
            
            // Render app content
            renderApplicationContent(app, printContainer, printType);
            
            // Trigger print dialog after a short delay to ensure rendering
            setTimeout(() => window.print(), 500);
        }
        return; // Stop normal setup
    }

    // Don't render CV immediately - wait for first navigation
    // createProjects(); // Removed to ensure fresh animation on first visit
    initApplicationPage(); // Initialize the application page UI
    
    //Sæt menu op
    //Hent alle sider som et array
    var allPages = selectAll('.page')
    //Løb listen igennem en for en 
    allPages.map(
       page => {
        // Skip hidden pages
        if (page.attribute('data-hidden') === 'true') return;

        //Lav et nyt <a> element 
        var menuItem = createElement('a')
        
        // Tjek om siden har et data-image
        var imageUrl = page.attribute('data-image');
        if (imageUrl) {
            // Hvis der er et billede, indsæt img element + tekst
            menuItem.addClass('home-logo');
            var img = createElement('img');
            img.attribute('src', imageUrl);
            img.attribute('alt', page.attribute('data-title'));
            menuItem.child(img);
            // Tilføj tekst efter billedet
            var textSpan = createElement('span');
            textSpan.html(page.attribute('data-title'));
            menuItem.child(textSpan);
        } else {
            // Ellers brug tekst som normalt
            menuItem.html(page.attribute('data-title'))
        }
        
        // Tilføj klasse og data-attribut til identifikation
        menuItem.addClass('menu-link');
        menuItem.attribute('data-target', '#' + page.attribute('id'));

        //sæt eventlistener på a tagget
        menuItem.mousePressed(
            () => shiftPage('#' + page.attribute('id'))
        )
        //sæt a tagget ind i sidebaren
        select('.sidebar').child(menuItem)
       }
    )

    //skift til current page (kald denne EFTER menuen er bygget)
    shiftPage(currentPage)
}

function keyPressed() {
    // Ctrl+4 (or Cmd+4) to show application page
    if (key === '4' && (keyIsDown(CONTROL) || keyIsDown(META))) {
        shiftPage('#page-application');
        return false; // Prevent default browser behavior
    }
}

function initApplicationPage() {
    var container = select('#application-container');
    container.html('');
    
    // Use template for controls
    var template = document.getElementById('application-controls-template');
    var clone = template.content.cloneNode(true);
    
    var dropdown = clone.querySelector('.app-selector');
    var btnFull = clone.querySelector('.print-full');
    var btnLetter = clone.querySelector('.print-letter');
    var btnCv = clone.querySelector('.print-cv');
    var btnRecs = clone.querySelector('.print-recommendations');
    
    // Populate dropdown
    if (applicationsData && applicationsData.applications) {
        applicationsData.applications.forEach(app => {
            var option = document.createElement('option');
            option.value = app.id;
            option.textContent = app.title;
            dropdown.appendChild(option);
        });
        
        // Auto-select first application
        if (applicationsData.applications.length > 0) {
            dropdown.value = applicationsData.applications[0].id;
        }
    }
    
    // Content Container
    var contentDiv = createDiv();
    contentDiv.id('app-content-area');
    
    // Logic
    dropdown.addEventListener('change', (e) => {
        var val = e.target.value;
        contentDiv.html(''); // Clear content
        
        if (val) {
            var app = applicationsData.applications.find(a => a.id === val);
            if (app) {
                renderApplicationContent(app, contentDiv, 'full');
                
                [btnFull, btnLetter, btnCv, btnRecs].forEach(btn => btn.removeAttribute('disabled'));
                
                btnFull.onclick = () => window.open(`?print=${app.id}&type=full`, '_blank');
                btnLetter.onclick = () => window.open(`?print=${app.id}&type=letter`, '_blank');
                btnCv.onclick = () => window.open(`?print=${app.id}&type=cv`, '_blank');
                btnRecs.onclick = () => window.open(`?print=${app.id}&type=recommendations`, '_blank');
            }
        } else {
            [btnFull, btnLetter, btnCv, btnRecs].forEach(btn => btn.setAttribute('disabled', 'true'));
        }
    });
    
    // Append to container (using .elt to append vanilla node)
    container.elt.appendChild(clone);
    container.child(contentDiv);
    
    // Trigger change event to load first application
    if (applicationsData && applicationsData.applications.length > 0) {
        dropdown.dispatchEvent(new Event('change'));
    }
}

function renderApplicationContent(app, container, printType = 'full') {
    var template = document.getElementById('application-template');
    var clone = template.content.cloneNode(true);

    // Helper to count filtered CV items
    var getFilteredCvList = () => {
        var list = cvData.cv.slice().sort((a, b) => a.order - b.order);
        if (app.cvConfig && app.cvConfig.excludeIds && app.cvConfig.excludeIds.length > 0) {
            list = list.filter(item => !app.cvConfig.excludeIds.includes(item.id));
        }
        // Filter by categories if specified
        if (app.cvConfig && app.cvConfig.categories && app.cvConfig.categories.length > 0) {
            list = list.filter(item => app.cvConfig.categories.includes(item.category));
        }
        return list;
    };
    
    // Only render letter parts if type is full or letter
    if (printType === 'full' || printType === 'letter') {
        // Sender Info
        clone.querySelector('.sender-name').textContent = contactData.name;
        clone.querySelector('.sender-address').textContent = contactData.address;
        clone.querySelector('.sender-zip').textContent = contactData.zip;
        clone.querySelector('.sender-phone').textContent = 'tlf: ' + contactData.phone;
        clone.querySelector('.sender-email').textContent = contactData.email;
        
        // Recipient Info
        clone.querySelector('.recipient-company').textContent = app.recipient.company;
        clone.querySelector('.recipient-attn').textContent = app.recipient.attn;
        clone.querySelector('.recipient-address').textContent = app.recipient.address;
        clone.querySelector('.recipient-zip').textContent = app.recipient.zip;
        
        // Letter Content
        clone.querySelector('.letter-meta.date').textContent = app.date;
        clone.querySelector('.letter-title').textContent = app.title;
        
        var bodyDiv = clone.querySelector('.letter-body');
        app.content.forEach(para => {
            if (para === '---') {
                var pb = document.createElement('div');
                pb.className = 'page-break';
                bodyDiv.appendChild(pb);
            } else {
                // Check for signature insertion before name
                if (para === contactData.name && contactData.signature && app.useSignature) {
                    var sigImg = document.createElement('img');
                    sigImg.src = contactData.signature;
                    sigImg.className = 'signature-img';
                    bodyDiv.appendChild(sigImg);
                }
                
                var p = document.createElement('p');
                p.textContent = para;
                bodyDiv.appendChild(p);
            }
        });
    } else {
        // Hide letter parts
        clone.querySelector('.doc-header').style.display = 'none';
        clone.querySelector('.letter-content').style.display = 'none';
    }
    
    // Recommendations Section - prepare BEFORE appending to DOM
    // Only if full or recommendations (NOT cv alone)
    if ((printType === 'full' || printType === 'recommendations') && app.recommendationsConfig && app.recommendationsConfig.include) {
        var recsSection = clone.querySelector('.recommendations-section');
        if (recsSection) {
            recsSection.style.display = 'block';
            
            // If printing ONLY recommendations, remove page break and top spacing
            if (printType === 'recommendations') {
                recsSection.style.pageBreakBefore = 'auto';
                recsSection.style.marginTop = '0';
                recsSection.style.borderTop = 'none';
            }
            
            var recsContainer = clone.querySelector('.app-recommendations-container');
            
            // Get all recommendations
            var recs = recommendationsData.recommendations;
            
            // Filter out excluded ones
            if (app.recommendationsConfig.excludeIds && app.recommendationsConfig.excludeIds.length > 0) {
                recs = recs.filter(r => !app.recommendationsConfig.excludeIds.includes(r.id));
            }
            
            // Filter out recommendations linked to excluded CV entries
            if (app.cvConfig && app.cvConfig.excludeIds && app.cvConfig.excludeIds.length > 0) {
                recs = recs.filter(r => {
                    // If no cvRefs, keep it (generic recommendation)
                    if (!r.cvRefs || r.cvRefs.length === 0) return true;
                    // If all linked CV entries are excluded, drop the recommendation
                    return !r.cvRefs.every(refId => app.cvConfig.excludeIds.includes(refId));
                });
            }
            
            // Filter duplicates by author (keep first occurrence)
            var seenAuthors = new Set();
            recs = recs.filter(rec => {
                if (seenAuthors.has(rec.author)) return false;
                seenAuthors.add(rec.author);
                return true;
            });
            
            // Render recommendations
            recs.forEach(rec => {
                var item = document.createElement('div');
                item.className = 'recommendation-item';
                
                // Use short version if configured, otherwise full quote
                var quoteText = app.recommendationsConfig.useShortVersion && rec.short ? rec.short : rec.quote;
                
                item.innerHTML = `
                    <p class="recommendation-quote">"${quoteText}"</p>
                    <div class="recommendation-meta">
                        <span class="recommendation-author">${rec.author}</span>
                        <span class="recommendation-role">${rec.role}</span>
                        ${rec.institution ? `<span class="recommendation-source">${rec.institution}, ${rec.year}</span>` : `<span class="recommendation-source">${rec.year}</span>`}
                    </div>
                `;
                
                recsContainer.appendChild(item);
            });
        }
    }

    // CV Section
    // Only if full or cv (NOT recommendations)
    if ((printType === 'full' || printType === 'cv') && app.cvConfig && app.cvConfig.include) {
        var cvSection = clone.querySelector('.cv-section');
        cvSection.style.display = 'block';

        if (printType === 'cv') {
             // Remove page break and margin for standalone CV
             cvSection.style.pageBreakBefore = 'auto';
             cvSection.style.marginTop = '0';
        }

        var cvContainerDiv = clone.querySelector('.app-cv-container');
        cvContainerDiv.className = 'print-cv-container';
        cvContainerDiv.innerHTML = '';

        // Append clone before rendering (p5 select needs it in DOM)
        container.elt.appendChild(clone);

        // Render all CV using print-specific function (no splitting)
        createPrintCV('.print-cv-container', app.cvConfig);
    } else {
        container.elt.appendChild(clone);
    }

    // References Section (deprecated, keeping for backwards compatibility)
    if (app.referencesConfig && app.referencesConfig.include) {
        var refSection = document.createElement('div');
        refSection.className = 'references-section';
        
        var refHeader = document.createElement('h2');
        refHeader.textContent = 'Referencer';
        refSection.appendChild(refHeader);

        var refList = document.createElement('div');
        refList.className = 'references-list';

        // Filter references if needed, otherwise show all
        var recs = recommendationsData.recommendations;
        if (app.referencesConfig.filterIds) {
            recs = recs.filter(r => app.referencesConfig.filterIds.includes(r.id));
        }

        // Filter out references linked to excluded CV entries
        if (app.cvConfig && app.cvConfig.excludeIds) {
            recs = recs.filter(r => {
                // If no refs, keep it (generic)
                if (!r.cvRefs || r.cvRefs.length === 0) return true;
                // If all linked CV entries are excluded, drop the recommendation
                return !r.cvRefs.every(refId => app.cvConfig.excludeIds.includes(refId));
            });
        }

        // Filter duplicates by author (keep first occurrence)
        var seenAuthors = new Set();
        recs = recs.filter(rec => {
            if (seenAuthors.has(rec.author)) return false;
            seenAuthors.add(rec.author);
            return true;
        });

        recs.forEach(rec => {
            var item = document.createElement('div');
            item.className = 'reference-item';
            
            item.innerHTML = `
                <div class="reference-content">
                    <p class="reference-quote">"${rec.short || rec.quote}"</p>
                    <div class="reference-meta">
                        <span class="reference-author">${rec.author}</span>
                        <span class="reference-role">${rec.role}</span>
                        <span class="reference-source">${rec.institution ? rec.institution + ', ' : ''}${rec.year}</span>
                    </div>
                </div>
            `;
            refList.appendChild(item);
        });

        refSection.appendChild(refList);
        container.elt.appendChild(refSection);
    }
}

function shiftPage(newPage){
    // Clear CV when leaving CV page
    if (currentPage === '#page2' && newPage !== '#page2') {
        select('#cv').html('');
        // Remove active filter states immediately
        selectAll('#cv-filter .filter-btn').forEach(btn => {
            btn.removeClass('active');
            btn.removeClass('active-delayed');
        });
    }

    // Clear Projects when leaving Projects page
    if (currentPage === '#page3' && newPage !== '#page3') {
        select('#projects').html('');
        select('#project-filter').html('');
    }

    // Clear Frontpage Animation when leaving Frontpage
    if (currentPage === '#page1' && newPage !== '#page1') {
        clear();
    }
    
    // Reset fade-in and zoom when entering Frontpage
    if (newPage === '#page1') {
        canvasOpacity = 0;
        animationStartTime = millis();
        // Reset particle animation
        particles.forEach(p => {
            p.animationProgress = 0;
            p.pos = createVector(width / 2, height / 2);
        });
    }

    select(currentPage).removeClass('show')
    select(newPage).addClass('show')
    currentPage = newPage

    // Opdater menu active state
    selectAll('.menu-link').map(link => link.removeClass('active'));
    var activeLink = select(`.menu-link[data-target="${newPage}"]`);
    if(activeLink) {
        activeLink.addClass('active');
    }

    // If navigating to CV page, wait for transition then render/animate
    if (newPage === '#page2') {
        var cvContainer = select('#cv');
        // Render filter immediately so it's visible during page transition
        var filterContainer = select('#cv-filter');
        if (filterContainer) {
            filterContainer.html('');
            // Create filter buttons immediately with data attributes
            const categories = [
                { id: 'job', title: 'Erhvervserfaring' },
                { id: 'education', title: 'Uddannelse' },
                { id: 'board', title: 'Organisation' }
            ];
            var allBtn = createSpan('Alle');
            allBtn.addClass('filter-btn active-delayed');
            allBtn.attribute('data-filter', 'all');
            allBtn.parent(filterContainer);
            allBtn.mousePressed(() => createCV('#cv', { filterCategory: 'all', animate: false }));
            categories.forEach(cat => {
                var btn = createSpan(cat.title);
                btn.addClass('filter-btn');
                btn.attribute('data-filter', cat.id);
                btn.parent(filterContainer);
                btn.mousePressed(() => createCV('#cv', { filterCategory: cat.id, animate: false }));
            });
        }
        setTimeout(() => {
            // Always clear and re-render to trigger animations
            cvContainer.html('');
            createCV('#cv', { skipFilter: true }); // Don't recreate filter
            
            // Activate filter underline after CV items start animating
            setTimeout(() => {
                var delayedBtn = select('#cv-filter .active-delayed');
                if (delayedBtn) {
                    delayedBtn.removeClass('active-delayed');
                    delayedBtn.addClass('active');
                }
            }, 500); // Activate during CV animation
        }, 650); // Slightly longer than .page transition (600ms)
    }

    // Projects page animation on enter
    if (newPage === '#page3') {
        createProjects({ onlyFilter: true }); // Render filter immediately
        
        setTimeout(() => {
            createProjects({ onlyContent: true }); // Render content delayed

             // Activate filter underline after items start animating
             setTimeout(() => {
                var delayedBtn = select('#project-filter .active-delayed');
                if (delayedBtn) {
                    delayedBtn.removeClass('active-delayed');
                    delayedBtn.addClass('active');
                }
            }, 500);
        }, 650);
    }
}

// Helper: Get filtered CV data
function getCVData(config = {}) {
    var sortedCV = cvData.cv.slice().sort((a, b) => a.order - b.order);

    if (config.excludeIds) {
        sortedCV = sortedCV.filter(job => !config.excludeIds.includes(job.id));
    }
    
    if (config.categories && config.categories.length > 0) {
        sortedCV = sortedCV.filter(job => config.categories.includes(job.category));
    }

    var offset = config.offset || 0;
    var limit = config.limit || sortedCV.length;
    sortedCV = sortedCV.slice(offset, offset + limit);

    if (config.filterCategory && config.filterCategory !== 'all') {
        sortedCV = sortedCV.filter(item => item.category === config.filterCategory);
    }

    return sortedCV;
}

// Helper: Render CV filter buttons
function renderCVFilter(containerId, config = {}) {
    if (containerId !== '#cv' || config.skipFilter) return;
    
    var filterContainer = select('#cv-filter');
    if (!filterContainer) return;

    const currentFilter = config.filterCategory || 'all';
    const categories = [
        { id: 'job', title: 'Erhvervserfaring' },
        { id: 'education', title: 'Uddannelse' },
        { id: 'board', title: 'Organisation' }
    ];
    
    var existingButtons = selectAll('#cv-filter .filter-btn');
    
    if (existingButtons.length === 0) {
        filterContainer.html('');
        
        var allBtn = createSpan('Alle');
        allBtn.addClass('filter-btn');
        allBtn.attribute('data-filter', 'all');
        if(currentFilter === 'all') allBtn.addClass('active');
        allBtn.parent(filterContainer);
        allBtn.mousePressed(() => createCV(containerId, { filterCategory: 'all' }));

        categories.forEach(cat => {
            var btn = createSpan(cat.title);
            btn.addClass('filter-btn');
            btn.attribute('data-filter', cat.id);
            if(currentFilter === cat.id) btn.addClass('active');
            btn.parent(filterContainer);
            btn.mousePressed(() => createCV(containerId, { filterCategory: cat.id }));
        });
    } else {
        existingButtons.forEach(btn => {
            btn.removeClass('active');
            btn.removeClass('active-delayed');
        });
        
        setTimeout(() => {
            existingButtons.forEach(btn => {
                var filterType = btn.attribute('data-filter');
                if (filterType === currentFilter) btn.addClass('active');
            });
        }, 10);
    }
}

// Helper: Render single CV item
function renderCVItem(job, index, cvContainer, containerId, config) {
    var template = select('#cv-template');
    var clone = template.elt.content.cloneNode(true);
    
    clone.querySelector('.cv-title').textContent = job.title;
    clone.querySelector('.cv-place').textContent = job.place;
    
    var yearText = job.startYear;
    if (job.endYear && job.endYear !== job.startYear) {
        yearText += ' - ' + job.endYear;
    }
    
    var yearEl = document.createElement('div');
    yearEl.className = 'cv-year';
    yearEl.textContent = yearText;
    
    var titleEl = clone.querySelector('.cv-title');
    titleEl.parentNode.insertBefore(yearEl, titleEl);
    
    if(job.description) {
        clone.querySelector('.cv-description').innerHTML = job.description;
        if(job.detail) {
            clone.querySelector('.cv-detail-text').innerHTML = job.detail;
        }
    }

    if(job.image) {
        var img = clone.querySelector('.cv-image');
        if(img) {
            img.src = job.image;
            img.style.display = 'block';
        }
    } else {
        var img = clone.querySelector('.cv-image');
        if(img) img.style.display ='none';
    }

    var metaSection = document.createElement('div');
    metaSection.className = 'cv-meta-section';

    if (job.link) {
        var linkEl = document.createElement('a');
        linkEl.href = job.link.url;
        linkEl.target = '_blank';
        linkEl.className = 'cv-link';
        linkEl.innerHTML = `
            <span>${job.link.text}</span>
            <svg class="cv-link-arrow" viewBox="0 -960 960 960" width="10" height="10">
                <path d="M647-440H160v-80h487L423-744l57-56 320 320-320 320-57-56 224-224Z" fill="currentColor"/>
            </svg>
        `;
        metaSection.appendChild(linkEl);
    }

    if (recommendationsData && recommendationsData.recommendations) {
        var recs = recommendationsData.recommendations.filter(r => r.cvRefs && r.cvRefs.includes(job.id));
        if (recs.length > 0) {
            var recContainer = document.createElement('div');
            recContainer.className = 'cv-recommendation';
            
            var labelText = recs.length > 1 ? 'Referencer' : 'Reference';
            var toggle = document.createElement('div');
            toggle.className = 'cv-rec-toggle';
            toggle.innerHTML = `
                <span class="cv-rec-label">${labelText}</span>
                <svg class="cv-rec-arrow" width="12" height="12" viewBox="0 0 12 12">
                    <path d="M3 4 L6 8 L9 4 Z" fill="black" />
                </svg>
            `;
            
            var content = document.createElement('div');
            content.className = 'cv-rec-content';
            
            recs.forEach((rec, i) => {
                var recItem = document.createElement('div');
                recItem.className = 'cv-rec-item';
                if (i > 0) recItem.style.marginTop = '1.5rem';
                recItem.innerHTML = `
                    <p class="cv-rec-quote">"${rec.short || rec.quote}"</p>
                    <p class="cv-rec-author">- ${rec.author}, ${rec.role}</p>
                `;
                content.appendChild(recItem);
            });
            
            recContainer.appendChild(toggle);
            recContainer.appendChild(content);
            toggle.addEventListener('click', (e) => {
                e.stopPropagation(); 
                recContainer.classList.toggle('open');
            });
            metaSection.appendChild(recContainer);
        }
    }

    if (metaSection.hasChildNodes()) {
        clone.querySelector('.cv-details').appendChild(metaSection);
    }

    var wrapper = clone.querySelector('.cv-wrapper');
    var entry = clone.querySelector('.cv-entry');

    if (job.category) {
        wrapper.classList.add('cat-' + job.category);
    }
    
    if (config.expanded) {
        wrapper.classList.add('show-details');
    } else {
        entry.addEventListener('mouseenter', () => {
            wrapper.classList.add('show-details');
        });
        entry.addEventListener('mouseleave', () => {
            wrapper.classList.remove('show-details');
            var openRecs = wrapper.querySelectorAll('.cv-recommendation.open');
            openRecs.forEach(rec => rec.classList.remove('open'));
        });
    }
    
    wrapper.style.gridRow = index + 1;
    if(index % 2 === 0) {
        wrapper.classList.add('left');
    } else {
        wrapper.classList.add('right');
    }

    if (containerId === '#cv') {
        wrapper.classList.add('cv-animate');
        var startDistance = 20 + (index * 2);
        wrapper.style.setProperty('--start-distance', startDistance + 'px');
        wrapper.style.animation = `cv-pearl 0.45s ease-out ${index * 50}ms both`;
    }
    
    cvContainer.elt.appendChild(clone);
}

function createCV(containerId, config = {}){
    var cvContainer = select(containerId);
    cvContainer.html('');
    
    console.log('createCV called with config:', config);

    // Get filtered data
    var displayItems = getCVData(config);
    
    // Render filter
    renderCVFilter(containerId, config);

    // Render vertical line
    var verticalLine = createElement('div');
    verticalLine.addClass('vertical-line');
    verticalLine.style('grid-row', '1 / span ' + displayItems.length);
    cvContainer.child(verticalLine);

    // Render each item
    displayItems.forEach((job, index) => {
        renderCVItem(job, index, cvContainer, containerId, config);
    });
    
    console.log('Total items rendered:', displayItems.length, 'skipFilter:', config.skipFilter);
    
    // Activate filter animation after items render
    if (containerId === '#cv' && !config.skipFilter && displayItems.length > 0) {
        var lastItemDelay = (displayItems.length - 1) * 50;
        var totalTime = lastItemDelay;
        setTimeout(() => {
            var delayedBtn = select('#cv-filter .active-delayed');
            if (delayedBtn) {
                delayedBtn.removeClass('active-delayed');
                delayedBtn.addClass('active');
            }
        }, totalTime);
    }
}

function createPrintCV(containerId, config = {}) {
    var cvContainer = select(containerId);
    cvContainer.html('');
    
    console.log('createPrintCV called with config:', config);

    // Get filtered data using shared helper
    var displayItems = getCVData(config);
    
    // Group by category if configured
    if (config.groupByCategory) {
        var categoryOrder = config.categoryOrder || ['job', 'education', 'board'];
        var categoryTitles = {
            'job': 'Erhvervserfaring',
            'education': 'Uddannelse',
            'board': 'Organisation'
        };
        
        // Group items by category
        var grouped = {};
        categoryOrder.forEach(cat => {
            grouped[cat] = displayItems.filter(item => item.category === cat);
        });
        
        // Render each category group
        categoryOrder.forEach(category => {
            if (grouped[category] && grouped[category].length > 0) {
                // Category header
                var header = document.createElement('h2');
                header.className = 'print-cv-category-header';
                header.textContent = categoryTitles[category];
                cvContainer.elt.appendChild(header);
                
                // Render items in this category
                grouped[category].forEach((job, index) => {
                    renderPrintCVItem(job, cvContainer);
                });
            }
        });
    } else {
        // Render all items without grouping
        displayItems.forEach((job, index) => {
            renderPrintCVItem(job, cvContainer);
        });
    }
    
    console.log('Print CV: Total items rendered:', displayItems.length);
}

function renderPrintCVItem(job, cvContainer) {
    // Create simple CV item (no template needed - build from scratch)
    var item = document.createElement('div');
    item.className = 'print-cv-item';
    
    // Category marker
    if (job.category) {
        item.classList.add('print-cat-' + job.category);
    }
    
    // Year
    var yearText = job.startYear;
    if (job.endYear && job.endYear !== job.startYear) {
        yearText += ' - ' + job.endYear;
    }
    
    var year = document.createElement('div');
    year.className = 'print-cv-year';
    year.textContent = yearText;
    item.appendChild(year);
    
    // Title
    var title = document.createElement('h3');
    title.className = 'print-cv-title';
    title.textContent = job.title;
    item.appendChild(title);
    
    // Place
    var place = document.createElement('p');
    place.className = 'print-cv-place';
    place.textContent = job.place;
    item.appendChild(place);
    
    // Description
    if (job.description) {
        var desc = document.createElement('p');
        desc.className = 'print-cv-description';
        desc.innerHTML = job.description;
        item.appendChild(desc);
    }
    
    // Image
    if (job.image) {
        var img = document.createElement('img');
        img.className = 'print-cv-image';
        img.src = job.image;
        item.appendChild(img);
    }
    
    cvContainer.elt.appendChild(item);
}

function renderApplicationOverview() {
    // Deprecated - functionality moved to initApplicationPage
}

function renderApplication(app) {
    // Deprecated - functionality moved to renderApplicationContent
}


function createProjects(config = {}){
    console.log('createProjects called', config);
    console.log('projectsData:', projectsData);

    const { onlyFilter, onlyContent } = config;

    // Helper to handle filtering
    const filterProjects = (category, activeBtn) => {
        // Update UI - Scope to project filter only
        var buttons = document.querySelectorAll('#project-filter .filter-btn');
        buttons.forEach(b => b.classList.remove('active'));
        if(activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.classList.remove('active-delayed');
        }

        // Filter cards
        var cards = document.querySelectorAll('.project-card');
        var visibleIndex = 0;

        cards.forEach(card => {
            var cardCategories = card.getAttribute('data-categories') ? card.getAttribute('data-categories').split(',') : [];
            if (category === 'all' || cardCategories.includes(category)) {
                card.style.display = 'flex';
                
                // Animation reset and re-apply
                card.style.animation = 'none';
                card.offsetHeight; // force reflow
                
                var delay = visibleIndex * 50;
                card.style.setProperty('--start-distance', '30px');
                card.style.animation = `project-appear 0.6s ease-out ${delay}ms both`;

                visibleIndex++;
            } else {
                card.style.display = 'none';
            }
        });
    };

    if (!onlyContent) {
        // Setup Filter
        var filterContainer = select('#project-filter');
        filterContainer.html('');
        
        // "All" button
        var allBtn = createSpan('Alle');
        // Initial state is active-delayed if redundant rendering is avoided, but otherwise handled by logic in shiftPage
        // For consistent initial render, we use active-delayed if this is the initial load (which usually means onlyFilter is true)
        if (onlyFilter) {
            allBtn.addClass('filter-btn active-delayed');
        } else {
            allBtn.addClass('filter-btn active');
        }
        allBtn.parent(filterContainer);
        allBtn.mousePressed(function() { filterProjects('all', this.elt); });

        // Category buttons
        projectCategories.forEach(cat => {
            var btn = createSpan(cat.title);
            btn.addClass('filter-btn');
            btn.parent(filterContainer);
            btn.mousePressed(function() { filterProjects(cat.id, this.elt); });
        });
    }

    if (onlyFilter) return;

    var container = select('#projects');
    container.html('');
    var template = select('#project-template');

    if (!projectsData || !projectsData.projects) {
        console.error('No projects data found');
        return;
    }

    projectsData.projects.map((project, index) => {
        var clone = template.elt.content.cloneNode(true);
        
        // Add data-categories for filtering
        var card = clone.querySelector('.project-card');
        if(card) {
            card.setAttribute('data-categories', project.categories.join(','));
            
            // Initial animation
            var delay = index * 50;
            card.style.setProperty('--start-distance', '30px');
            card.style.animation = `project-appear 0.6s ease-out ${delay}ms both`;
        }

        // Find category titles
        var catTitles = project.categories.map(catId => {
            var catObj = projectCategories.find(c => c.id === catId);
            return catObj ? catObj.title : catId;
        }).join(', ');

        // Fill data
        if(project.year) {
            clone.querySelector('.project-year').textContent = project.year;
        }
        clone.querySelector('.project-title').textContent = project.title;
        clone.querySelector('.project-category').textContent = catTitles;
        clone.querySelector('.project-context').textContent = project.context;
        
        var descElement = clone.querySelector('.project-description');
        descElement.innerHTML = project.description;

        if(project.links && project.links.length > 0) {
            project.links.forEach(link => {
                var linkElement = document.createElement('a');
                linkElement.href = link;
                linkElement.target = '_blank';
                linkElement.className = 'project-link';
                
                linkElement.innerHTML = `
                    <span>Læs mere (PDF)</span>
                    <svg class="project-link-arrow" viewBox="0 -960 960 960" width="10" height="10">
                        <path d="M647-440H160v-80h487L423-744l57-56 320 320-320 320-57-56 224-224Z" fill="currentColor"/>
                    </svg>
                `;
                
                // Append to content container
                clone.querySelector('.project-content').appendChild(linkElement);
            });
        }
        
        // Flyt hele content ind i media containeren
        var content = clone.querySelector('.project-content');
        var mediaContainer = clone.querySelector('.project-media-container');
        mediaContainer.appendChild(content);

        // Flyt scroll indicator ind i media containeren for at sikre korrekt z-index
        var scrollIndicator = clone.querySelector('.scroll-indicator');
        if(scrollIndicator) {
            mediaContainer.appendChild(scrollIndicator);
        }

        // Create wrapper for double animation
        var mediaWrapper = document.createElement('div');
        mediaWrapper.classList.add('media-wrapper');
        mediaContainer.appendChild(mediaWrapper);

        // Media
        if(project.video){
            var video = document.createElement('video');
            video.src = project.video;
            video.muted = true;
            video.loop = true;
            video.autoplay = false; // Stop autoplay
            video.playsInline = true;
            mediaWrapper.appendChild(video);

            // Afspil ved hover på hele kortet
            card.addEventListener('mouseenter', () => {
                video.play();
            });
            card.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0; // Reset video
            });

        } else if(project.images && project.images.length > 0){
            if(project.images.length > 1) {
                // Slideshow setup
                project.images.forEach((src, index) => {
                    var img = document.createElement('img');
                    img.src = src;
                    if (project.imageFit) {
                        img.style.objectFit = project.imageFit;
                    }
                    img.classList.add('slide-image');
                    if(index === 0) img.classList.add('active');
                    mediaWrapper.appendChild(img);
                });

                // Slideshow logic (only on hover)
                let intervalId = null;
                let currentIndex = 0;
                const images = mediaWrapper.querySelectorAll('.slide-image');

                const startSlideshow = () => {
                    if (intervalId) return;
                    // Skift med det samme eller vent? Vent lidt så man ser coveret først
                    intervalId = setInterval(() => {
                        // Stop før vi looper (kør kun én gang)
                        if (currentIndex >= images.length - 1) {
                            clearInterval(intervalId);
                            intervalId = null;
                            return;
                        }

                        images[currentIndex].classList.remove('active');
                        currentIndex++;
                        images[currentIndex].classList.add('active');
                    }, 2000);
                };

                const stopSlideshow = () => {
                    if (intervalId) {
                        clearInterval(intervalId);
                        intervalId = null;
                    }
                    // Reset til cover billede (index 0)
                    images.forEach(img => img.classList.remove('active'));
                    currentIndex = 0;
                    images[0].classList.add('active');
                };

                card.addEventListener('mouseenter', startSlideshow);
                card.addEventListener('mouseleave', stopSlideshow);
            } else {
                var img = document.createElement('img');
                img.src = project.images[0];
                if (project.imageFit) {
                    img.style.objectFit = project.imageFit;
                }
                mediaWrapper.appendChild(img);
            }
        }

        // Scroll Indicator Logic
        // scrollIndicator var allerede defineret ovenfor
        
        // Check overflow on hover
        card.addEventListener('mouseenter', () => {
            // Function to check overflow
            const checkOverflow = () => {
                // Add a buffer of 40px (approx 2 lines) so it only shows if there's significant overflow
                if (content.scrollHeight > content.clientHeight + 50) {
                    scrollIndicator.classList.add('visible');
                } else {
                    scrollIndicator.classList.remove('visible');
                }
            };
            
            // Wait for the slide-up animation (0.5s) to finish before checking
            // Checking immediately gives wrong results because of the initial margin-top on context
            setTimeout(checkOverflow, 550);
        });

        card.addEventListener('mouseleave', () => {
            scrollIndicator.classList.remove('visible');
            content.scrollTop = 0; // Reset scroll
            scrollIndicator.style.opacity = ''; // Reset inline style
        });

        // Hide indicator on scroll
        content.addEventListener('scroll', () => {
             if(content.scrollTop > 10) {
                 scrollIndicator.style.opacity = '0';
             } else {
                 if(scrollIndicator.classList.contains('visible')) {
                    scrollIndicator.style.opacity = '1';
                 }
             }
        });

        container.elt.appendChild(clone);
    });
}
// --- Frontpage Animation ---
function draw() {
    // Only animate on frontpage to save performance
    if (currentPage !== '#page1') return;
    
    // Check if animation delay has passed
    var elapsed = millis() - animationStartTime;
    var animationDelay = 500; // 0.5 seconds delay
    
    if (elapsed > animationDelay) {
        // Quick fade in (1 second)
        if (canvasOpacity < 255) {
            canvasOpacity += 255 / 60; // 1 second at 60fps
            canvasOpacity = min(canvasOpacity, 255);
        }
    }
    
    clear();
    
    particles.forEach(p => {
        p.update();
        p.display();
        p.connect(particles);
    });
}

function windowResized() {
    resizeCanvas(window.innerWidth, window.innerHeight);
}

class Particle {
    constructor() {
        // Final target position
        this.targetPos = createVector(random(width), random(height));
        // Start from center
        this.pos = createVector(width / 2, height / 2);
        // Slow organic movement after animation
        this.vel = createVector(random(-0.5, 0.5), random(-0.5, 0.5));
        this.size = random(4, 7);
        this.animationProgress = 0;
    }
    
    update() {
        // Quick radial expansion during intro
        if (this.animationProgress < 1) {
            this.animationProgress += 0.015; // Slower expansion
            this.animationProgress = min(this.animationProgress, 1);
            
            // Ease-out interpolation
            let eased = 1 - pow(1 - this.animationProgress, 3);
            this.pos = p5.Vector.lerp(createVector(width / 2, height / 2), this.targetPos, eased);
        } else {
            // Normal floating behavior after animation
            this.pos.add(this.vel);
            
            // Slight mouse interaction
            let d = dist(mouseX, mouseY, this.pos.x, this.pos.y);
            if (d < 150) {
                let repulsion = createVector(this.pos.x - mouseX, this.pos.y - mouseY);
                repulsion.setMag(0.1);
                this.vel.add(repulsion);
                this.vel.limit(1.5);
            } else {
                this.vel.limit(0.6);
            }

            // Wrap edges
            if (this.pos.x < 0) this.pos.x = width;
            if (this.pos.x > width) this.pos.x = 0;
            if (this.pos.y < 0) this.pos.y = height;
            if (this.pos.y > height) this.pos.y = 0;
        }
    }
    
    display() {
        noStroke();
        fill(0, canvasOpacity);
        ellipse(this.pos.x, this.pos.y, this.size);
    }
    
    connect(others) {
        // Only show connections after animation and very subtle
        if (this.animationProgress < .5) return;
        
        others.forEach(other => {
            if (other.animationProgress < .5) return;
            
            let d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
            if (d < 100) {
                let alpha = map(d, 0, 100, canvasOpacity * 0.2, 0); // Very subtle
                stroke(0, alpha);
                strokeWeight(0.5);
                line(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
            }
        });
    }
}
