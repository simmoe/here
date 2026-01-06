var currentPage = '#page1'
var cvData;
var projectsData;
var recommendationsData;
var contactData;
var applicationsData;
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
    createProjects();
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
        //Sæt a taggets html til sidens titel
        menuItem.html(page.attribute('data-title'))
        
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
    
    // Populate dropdown
    if (applicationsData && applicationsData.applications) {
        applicationsData.applications.forEach(app => {
            var option = document.createElement('option');
            option.value = app.id;
            option.textContent = app.title;
            dropdown.appendChild(option);
        });
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
                
                [btnFull, btnLetter, btnCv].forEach(btn => btn.removeAttribute('disabled'));
                
                btnFull.onclick = () => window.open(`?print=${app.id}&type=full`, '_blank');
                btnLetter.onclick = () => window.open(`?print=${app.id}&type=letter`, '_blank');
                btnCv.onclick = () => window.open(`?print=${app.id}&type=cv`, '_blank');
            }
        } else {
            [btnFull, btnLetter, btnCv].forEach(btn => btn.setAttribute('disabled', 'true'));
        }
    });
    
    // Append to container (using .elt to append vanilla node)
    container.elt.appendChild(clone);
    container.child(contentDiv);
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
    // Only if full or cv
    if ((printType === 'full' || printType === 'cv') && app.recommendationsConfig && app.recommendationsConfig.include) {
        var recsSection = clone.querySelector('.recommendations-section');
        if (recsSection) {
            recsSection.style.display = 'block';
            
            // If printing ONLY CV, remove the top margin/border from recommendations if it's the first thing?
            // Actually, CV comes first, so recommendations are always after CV.
            // But if we print CV only, we might want to adjust spacing.
            // For now, keep as is.
            
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
    // Only if full or cv
    if ((printType === 'full' || printType === 'cv') && app.cvConfig && app.cvConfig.include) {
        var cvSection = clone.querySelector('.cv-section');
        cvSection.style.display = 'block';

        if (printType === 'cv') {
             // Remove page break and margin for standalone CV
             cvSection.style.pageBreakBefore = 'auto';
             cvSection.style.marginTop = '0';
        }

        // Split CV into two pages after 16 entries
        var filteredList = getFilteredCvList();
        var firstCount = Math.min(16, filteredList.length);
        var secondCount = Math.max(0, filteredList.length - firstCount);

        var cvContainerDiv = clone.querySelector('.app-cv-container');
        // Ensure pages stack vertically (not in the original grid)
        cvContainerDiv.className = 'cv-pages-wrapper';
        cvContainerDiv.innerHTML = '';

        // First page
        var firstDiv = document.createElement('div');
        firstDiv.className = 'app-cv-container cv-page';
        var uniqueId1 = 'cv-' + Math.random().toString(36).substr(2, 9);
        firstDiv.id = uniqueId1;
        cvContainerDiv.appendChild(firstDiv);

        // Second page if needed
        if (secondCount > 0) {
            var secondDiv = document.createElement('div');
            secondDiv.className = 'app-cv-container cv-page';
            var uniqueId2 = 'cv-' + Math.random().toString(36).substr(2, 9);
            secondDiv.id = uniqueId2;
            cvContainerDiv.appendChild(secondDiv);
        }

        // Append clone before rendering (p5 select needs it in DOM)
        container.elt.appendChild(clone);

        // Render first chunk
        createCV('#' + uniqueId1, { ...app.cvConfig, offset: 0, limit: firstCount });

        // If there is a second page, add a static continuation arrow at bottom of first page (print-safe)
        if (secondCount > 0) {
            var indicator = document.createElement('div');
            indicator.className = 'cv-page-indicator';
            indicator.innerHTML = `
                <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M3 4 L6 8 L9 4 Z" />
                </svg>
            `;
            firstDiv.appendChild(indicator);
        }

        // Render second chunk if present
        if (secondCount > 0) {
            createCV('#' + cvContainerDiv.lastChild.id, { ...app.cvConfig, offset: firstCount, limit: secondCount });
        }
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
}

function createCV(containerId, config = {}){
    var cvContainer = select(containerId);
    cvContainer.html(''); // Clear existing content
    
    console.log('createCV called with config:', config);

    // Sorter data efter 'order' attributten
    var sortedCV = cvData.cv.slice().sort((a, b) => a.order - b.order);

    // Filter if config has excludeIds
    if (config.excludeIds) {
        sortedCV = sortedCV.filter(job => !config.excludeIds.includes(job.id));
    }

    // Apply offset/limit if provided (for print splitting)
    var offset = config.offset || 0;
    var limit = config.limit || sortedCV.length;
    sortedCV = sortedCV.slice(offset, offset + limit);

    // Define categories
    const categories = [
        { id: 'job', title: 'Erhvervserfaring' },
        { id: 'education', title: 'Uddannelse' },
        { id: 'board', title: 'Organisation' }
    ];

    // --- Filter Logic ---
    // Only render filter if we are in the main CV view (not print mode with specific config)
    if (containerId === '#cv' && !config.skipFilter) {
        var filterContainer = select('#cv-filter');
        if (filterContainer) {
            const currentFilter = config.filterCategory || 'all';
            
            // Check if filter is already rendered
            var existingButtons = selectAll('#cv-filter .filter-btn');
            
            if (existingButtons.length === 0) {
                // First render - create all buttons
                filterContainer.html('');
                
                // All button
                var allBtn = createSpan('Alle');
                allBtn.addClass('filter-btn');
                allBtn.attribute('data-filter', 'all');
                if(currentFilter === 'all') {
                    allBtn.addClass('active');
                }
                allBtn.parent(filterContainer);
                allBtn.mousePressed(() => createCV(containerId, { filterCategory: 'all' }));

                categories.forEach(cat => {
                    var btn = createSpan(cat.title);
                    btn.addClass('filter-btn');
                    btn.attribute('data-filter', cat.id);
                    if(currentFilter === cat.id) {
                        btn.addClass('active');
                    }
                    btn.parent(filterContainer);
                    btn.mousePressed(() => createCV(containerId, { filterCategory: cat.id }));
                });
            } else {
                // Filter exists - just update active states with transition
                existingButtons.forEach(btn => {
                    btn.removeClass('active');
                    btn.removeClass('active-delayed');
                });
                
                // Use small delay to allow browser to process the removal
                setTimeout(() => {
                    existingButtons.forEach(btn => {
                        var filterType = btn.attribute('data-filter');
                        if (filterType === currentFilter) {
                            btn.addClass('active');
                        }
                    });
                }, 10);
            }
        }
    }

    // Filter items based on active category
    let displayItems = sortedCV;
    if (config.filterCategory && config.filterCategory !== 'all') {
        displayItems = sortedCV.filter(item => item.category === config.filterCategory);
    }

    // Lav den vertikale linje som et separat element
    var verticalLine = createElement('div');
    verticalLine.addClass('vertical-line');
    // Lad linjen spænde over alle rækker
    verticalLine.style('grid-row', '1 / span ' + displayItems.length);
    cvContainer.child(verticalLine);

    // Hent template med p5 select
    var template = select('#cv-template');

    displayItems.forEach((job, index) => {
        // Klon template indhold (Her er vi nødt til at bruge vanilla JS property .elt)
        var clone = template.elt.content.cloneNode(true);
        
        // Udfyld data (Vanilla JS querySelector på klonen)
        clone.querySelector('.cv-title').textContent = job.title;
        clone.querySelector('.cv-place').textContent = job.place;
        
        // Add Year
        var yearText = job.startYear;
        if (job.endYear && job.endYear !== job.startYear) {
            yearText += ' - ' + job.endYear;
        }
        
        var yearEl = document.createElement('div');
        yearEl.className = 'cv-year';
        yearEl.textContent = yearText;
        
        // Insert before title
        var titleEl = clone.querySelector('.cv-title');
        titleEl.parentNode.insertBefore(yearEl, titleEl);
        
        // Udfyld detaljer hvis de findes
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
            if(img) img.style.display = 'none';
        }

        // Meta Section (Links, Recommendations)
        var metaSection = document.createElement('div');
        metaSection.className = 'cv-meta-section';

        // Link
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

        // Recommendations
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
                
                // Toggle logic
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    recContainer.classList.toggle('open');
                });

                metaSection.appendChild(recContainer);
            }
        }

        // Only append meta section if it has content
        if (metaSection.hasChildNodes()) {
            clone.querySelector('.cv-details').appendChild(metaSection);
        }

        // Find wrapperen i klonen
        var wrapper = clone.querySelector('.cv-wrapper');
        var entry = clone.querySelector('.cv-entry');

        // Category marker class for styling
        if (job.category) {
            wrapper.classList.add('cat-' + job.category);
        }
        
        // Force expand if configured
        if (config.expanded) {
            wrapper.classList.add('show-details');
        } else {
            // Åbn når man rører selve indholdet (ikke linjen)
            entry.addEventListener('mouseenter', () => {
                wrapper.classList.add('show-details');
            });

            // Luk når musen forlader indholdet (f.eks. ud på linjen)
            entry.addEventListener('mouseleave', () => {
                wrapper.classList.remove('show-details');
                // Close any open recommendations
                var openRecs = wrapper.querySelectorAll('.cv-recommendation.open');
                openRecs.forEach(rec => rec.classList.remove('open'));
            });
        }
        
        // Placer i grid
        wrapper.style.gridRow = index + 1;

        if(index % 2 === 0) {
            wrapper.classList.add('left');
        } else {
            wrapper.classList.add('right');
        }

        // Staggered appear animation for main CV view
        if (containerId === '#cv') {
            wrapper.classList.add('cv-animate');
            // Gradvist øgende startafstand: 20px + 4px per perle
            var startDistance = 20 + (index * 2);
            wrapper.style.setProperty('--start-distance', startDistance + 'px');
            wrapper.style.animation = `cv-pearl 0.45s ease-out ${index * 50}ms both`;
        }
        
        // Tilføj til containeren
        cvContainer.elt.appendChild(clone);
    });
    console.log('Total items rendered:', displayItems.length, 'skipFilter:', config.skipFilter);
    // After all items are added, calculate when animation completes and activate filter
    // (Only runs when filter is recreated during category switching)
    if (containerId === '#cv' && !config.skipFilter && displayItems.length > 0) {
        var lastItemDelay = (displayItems.length - 1) * 50;
        var animationDuration = 0;
        var totalTime = lastItemDelay + animationDuration;
        
        setTimeout(() => {
            var delayedBtn = select('#cv-filter .active-delayed');
            if (delayedBtn) {
                delayedBtn.removeClass('active-delayed');
                delayedBtn.addClass('active');
            }
        }, totalTime);
    }
}

function renderApplicationOverview() {
    // Deprecated - functionality moved to initApplicationPage
}

function renderApplication(app) {
    // Deprecated - functionality moved to renderApplicationContent
}


function createProjects(){
    console.log('createProjects called');
    console.log('projectsData:', projectsData);

    // Setup Filter
    var filterContainer = select('#project-filter');
    filterContainer.html('');
    
    // Helper to handle filtering
    const filterProjects = (category, activeBtn) => {
        // Update UI - Scope to project filter only
        var buttons = document.querySelectorAll('#project-filter .filter-btn');
        buttons.forEach(b => b.classList.remove('active'));
        activeBtn.classList.add('active');

        // Filter cards
        var cards = document.querySelectorAll('.project-card');
        cards.forEach(card => {
            var cardCategories = card.getAttribute('data-categories') ? card.getAttribute('data-categories').split(',') : [];
            if (category === 'all' || cardCategories.includes(category)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    };

    // "All" button
    var allBtn = createSpan('Alle');
    allBtn.addClass('filter-btn active');
    allBtn.parent(filterContainer);
    allBtn.mousePressed(function() { filterProjects('all', this.elt); });

    // Category buttons
    projectCategories.forEach(cat => {
        var btn = createSpan(cat.title);
        btn.addClass('filter-btn');
        btn.parent(filterContainer);
        btn.mousePressed(function() { filterProjects(cat.id, this.elt); });
    });

    var container = select('#projects');
    var template = select('#project-template');

    if (!projectsData || !projectsData.projects) {
        console.error('No projects data found');
        return;
    }

    projectsData.projects.map(project => {
        var clone = template.elt.content.cloneNode(true);
        
        // Add data-categories for filtering
        var card = clone.querySelector('.project-card');
        if(card) card.setAttribute('data-categories', project.categories.join(','));

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
