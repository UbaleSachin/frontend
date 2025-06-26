class ResumeExtractor {
    constructor() {
        this.selectedFiles = [];
        this.extractedData = null;
        this.jobDescriptionData = null;
        this.initializeEventListeners();
        this.initializeJobDescriptionEvents();
    }

    initializeEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const extractBtn = document.getElementById('extractBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const removeAllBtn = document.getElementById('removeAllBtn');
        const generateBtn = document.getElementById('generateBtn');

        if (generateBtn) {
            generateBtn.addEventListener('click', async () => {
                // Call both extractData and extractJobDescription in sequence
                await this.extractData();
                await this.extractJobDescription();

                if (this.extractedData && this.jobDescriptionData) {
                    this.fetchCandidateFit();
                }
            });
        }

        // Prevent file dialog from reopening after cancel
        if (fileInput) {
            fileInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Only open file dialog on direct click, not on drop
        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', (e) => {
                if (e.target === fileInput) return; // Already handled
                fileInput.value = ''; // Reset so selecting the same file twice works
                fileInput.click();
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // Drag and drop events
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        }

        // Button events
        if (extractBtn) {
            extractBtn.addEventListener('click', () => this.extractData());
        }
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadData());
        }
        if (removeAllBtn) {
            removeAllBtn.addEventListener('click', () => this.removeAllFiles());
        }
    }

    initializeJobDescriptionEvents() {
        const jdUploadArea = document.getElementById('jdUploadArea');
        const jdInput = document.getElementById('jdInput');

        // Only initialize if elements exist
        if (!jdUploadArea || !jdInput) {
            console.warn('Job description elements not found. Make sure you have elements with IDs "jdUploadArea" and "jdInput" in your HTML.');
            return;
        }

        // Create file input for job description
        this.createJobDescriptionFileInput();

        // Create preview element if it doesn't exist
        this.createJobDescriptionPreview();

        const jdFileInput = document.getElementById('jdFileInput');

        // Drag and drop for job description
        jdUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            jdUploadArea.classList.add('dragover');
        });

        jdUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Only remove dragover if we're actually leaving the drop area
            if (!jdUploadArea.contains(e.relatedTarget)) {
                jdUploadArea.classList.remove('dragover');
            }
        });

        jdUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            jdUploadArea.classList.remove('dragover');
            
            // Try to get text from dropped files or plain text
            if (e.dataTransfer.items) {
                for (let i = 0; i < e.dataTransfer.items.length; i++) {
                    const item = e.dataTransfer.items[i];
                    if (item.kind === 'string' && item.type === 'text/plain') {
                        item.getAsString((str) => {
                            jdInput.value = str;
                            this.updateJobDescriptionPreview();
                        });
                        return;
                    } else if (item.kind === 'file') {
                        const file = item.getAsFile();
                        if (file && (file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc'))) {
                            this.readJobDescriptionFile(file);
                            return;
                        }
                    }
                }
            }
            
            // Fallback: try to get plain text
            const text = e.dataTransfer.getData('text/plain');
            if (text) {
                jdInput.value = text;
                this.updateJobDescriptionPreview();
            }
        });

        // Click to open file dialog or focus textarea
        jdUploadArea.addEventListener('click', (e) => {
            // If clicking on textarea, let it focus normally
            if (e.target === jdInput) {
                return;
            }
            
            // If clicking on the upload area but not on textarea, open file dialog
            if (jdFileInput && !jdInput.contains(e.target)) {
                jdFileInput.value = ''; // Reset so selecting the same file twice works
                jdFileInput.click();
            }
        });

        // Handle file selection from file input
        if (jdFileInput) {
            jdFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.readJobDescriptionFile(file);
                }
            });
        }

        // Listen for input changes
        jdInput.addEventListener('input', () => {
            this.updateJobDescriptionPreview();
        });

        // Listen for paste events
        jdInput.addEventListener('paste', () => {
            setTimeout(() => this.updateJobDescriptionPreview(), 10);
        });

        // Initialize preview
        this.updateJobDescriptionPreview();
    }

    createJobDescriptionFileInput() {
        // Check if file input already exists
        let jdFileInput = document.getElementById('jdFileInput');
        if (!jdFileInput) {
            jdFileInput = document.createElement('input');
            jdFileInput.type = 'file';
            jdFileInput.id = 'jdFileInput';
            jdFileInput.accept = '.txt,.doc,.docx,.pdf';
            jdFileInput.style.display = 'none';
            document.body.appendChild(jdFileInput);
        }
    }

    readJobDescriptionFile(file) {
        const jdInput = document.getElementById('jdInput');
        if (!jdInput) return;

        // For .txt files, read directly
        if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                jdInput.value = evt.target.result;
                this.updateJobDescriptionPreview();
            };
            reader.readAsText(file);
        } 
        // For other file types, show message
        else {
            this.showError(`File "${file.name}" format not fully supported for job descriptions. Please use .txt files or copy/paste the content directly.`);
        }
    }

    createJobDescriptionPreview() {
        const jdUploadArea = document.getElementById('jdUploadArea');
        if (!jdUploadArea) return;

        // Check if preview already exists
        let jdPreview = document.getElementById('jdPreview');
        if (!jdPreview) {
            jdPreview = document.createElement('div');
            jdPreview.id = 'jdPreview';
            jdPreview.style.cssText = `
                display: none;
                margin-top: 15px;
                padding: 12px;
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                font-size: 0.9rem;
            `;
            jdUploadArea.appendChild(jdPreview);
        }
    }

    updateJobDescriptionPreview() {
        const jdInput = document.getElementById('jdInput');
        let jdPreview = document.getElementById('jdPreview');
        
        if (!jdInput) return;
        
        // Create preview if it doesn't exist
        if (!jdPreview) {
            this.createJobDescriptionPreview();
            jdPreview = document.getElementById('jdPreview');
        }
        
        const text = jdInput.value.trim();
        if (text) {
            const wordCount = text.split(/\s+/).length;
            const charCount = text.length;
            jdPreview.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="color: #28a745;">✓ Job Description Added</strong>
                    <small style="color: #6c757d;">${wordCount} words, ${charCount} characters</small>
                </div>
                <div style="max-height: 80px; overflow-y: auto; padding: 8px; background: white; border-radius: 4px; border: 1px solid #dee2e6;">
                    ${text.substring(0, 300)}${text.length > 300 ? '...' : ''}
                </div>
            `;
            jdPreview.style.display = 'block';
        } else {
            jdPreview.style.display = 'none';
        }
    }

    removeAllFiles() {
        this.selectedFiles = [];
        this.displaySelectedFiles();
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.classList.add('dragover');
        }
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.classList.remove('dragover');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.classList.remove('dragover');
        }
        
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }

    processFiles(files) {
        // Filter supported file types
        const supportedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain'
        ];

        const validFiles = files.filter(file => {
            const isValid = supportedTypes.includes(file.type) || 
                           file.name.toLowerCase().endsWith('.pdf') ||
                           file.name.toLowerCase().endsWith('.doc') ||
                           file.name.toLowerCase().endsWith('.docx') ||
                           file.name.toLowerCase().endsWith('.xls') ||
                           file.name.toLowerCase().endsWith('.xlsx') ||
                           file.name.toLowerCase().endsWith('.txt');
            
            if (!isValid) {
                this.showError(`File "${file.name}" is not supported. Please upload PDF, DOC, DOCX, XLS, XLSX, or TXT files.`);
            }
            return isValid;
        });

        if (validFiles.length > 0) {
            this.selectedFiles = [...this.selectedFiles, ...validFiles];
            this.displaySelectedFiles();
            this.hideError();
        }
    }

    displaySelectedFiles() {
        const filesPreview = document.getElementById('filesPreview');
        const filesList = document.getElementById('filesList');
        
        if (!filesPreview || !filesList) return;
        
        if (this.selectedFiles.length === 0) {
            filesPreview.style.display = 'none';
            return;
        }

        filesPreview.style.display = 'block';
        filesPreview.classList.add('fade-in');
        
        filesList.innerHTML = '';
        
        this.selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item slide-in';
            fileItem.style.animationDelay = `${index * 0.1}s`;
            
            fileItem.innerHTML = `
                <div class="file-info">
                    <div class="file-icon">${this.getFileIcon(file.name)}</div>
                    <div class="file-details">
                        <h4>${file.name}</h4>
                        <p>${this.formatFileSize(file.size)} • ${file.type || 'Unknown type'}</p>
                    </div>
                </div>
                <button class="remove-file" onclick="window.resumeExtractor.removeFile(${index})">×</button>
            `;
            
            filesList.appendChild(fileItem);
        });
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.displaySelectedFiles();
    }

    getFileIcon(filename) {
        const extension = filename.toLowerCase().split('.').pop();
        const icons = {
            'pdf': '📄',
            'doc': '📝',
            'docx': '📝',
            'xls': '📊',
            'xlsx': '📊',
            'txt': '📄'
        };
        return icons[extension] || '📄';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async extractData() {
        if (this.selectedFiles.length === 0) {
            this.showError('Please select at least one file to extract data.');
            return;
        }

        this.showLoading();
        this.hideError();

        try {
            const formData = new FormData();
            this.selectedFiles.forEach((file, index) => {
                formData.append('files', file);
            });
            
            const response = await fetch('https://resume-info-extractor.up.railway.app/extract-resume', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.extractedData = data;
            this.displayResults(data);
            
        } catch (error) {
           console.error('Error extracting data:', error);
           this.showError('Failed to extract data. Please make sure the server is running and try again.');
        } finally {
            this.hideLoading();
        }
    }

    async extractJobDescription() {
        const jdInput = document.getElementById('jdInput');
        if (!jdInput || !jdInput.value.trim()) {
            this.showError('Please enter or drop a job description.');
            return;
        }

        this.showLoading();
        this.hideError();

        try {
            const jobDescriptionText = jdInput.value.trim();
            // Optionally, you can still call your backend for JD extraction if needed
            // But for candidate fit, store the string
            this.jobDescriptionData = jobDescriptionText;

            // If you want to call /extract-job-description, do it here, but don't overwrite jobDescriptionData with the response object

            this.showSuccess('Job description processed successfully!');
        } catch (error) {
            console.error('Error extracting job description:', error);
            this.showError('Failed to extract job description. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async fetchCandidateFit() {
        // Check if we have both resume and job description data
        if (!this.extractedData || !this.jobDescriptionData) {
            this.showError('Please extract both resume data and job description first.');
            return;
        }

        this.hideError();
        
        try {
            // Fix: Send the first resume from the extracted data array
            const resumeDataToSend = this.extractedData.extracted_data && this.extractedData.extracted_data.length > 0 
                ? this.extractedData.extracted_data[0] // Send first resume for evaluation
                : this.extractedData;

            console.log('Sending resume data:', resumeDataToSend);
            console.log('Sending job description:', this.jobDescriptionData);

            const response = await fetch('https://resume-info-extractor.up.railway.app/candidate-fit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    resume_data: resumeDataToSend,
                    job_description_data: this.jobDescriptionData
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const data = await response.json();
            console.log('Candidate fit response:', data);
            this.displayCandidateFit(data);
        } catch (error) {
            console.error('Error fetching candidate fit:', error);
            this.showError(`Failed to fetch candidate fit summary: ${error.message}`);
        }
    }

    displayCandidateFit(data) {
        let candidateFitSection = document.getElementById('candidateFitSection');
        if (!candidateFitSection) {
            // Create the section above the download button
            const resultsSection = document.getElementById('resultsSection');
            candidateFitSection = document.createElement('div');
            candidateFitSection.id = 'candidateFitSection';
            candidateFitSection.className = 'candidate-fit-section';
            candidateFitSection.style.marginBottom = '30px';
            candidateFitSection.innerHTML = `
                <h3 style="margin-bottom: 15px;">Candidate Fit Analysis</h3>
                <div id="candidateFitContent" style="background: #f8f9fa; border-radius: 8px; padding: 18px; border: 1px solid #e9ecef; font-size: 1.05rem;"></div>
            `;
            // Insert before download options
            const downloadOptions = document.querySelector('.download-options');
            if (resultsSection && downloadOptions) {
                resultsSection.insertBefore(candidateFitSection, downloadOptions);
            } else if (resultsSection) {
                resultsSection.prepend(candidateFitSection);
            }
        }

        const fitContent = document.getElementById('candidateFitContent');
        if (fitContent) {
            if (data && data.fit_result) {
                const fitResult = data.fit_result;
                let html = `
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <strong style="font-size: 1.1em;">Fit Score: ${fitResult.fit_percentage}%</strong>
                            <div style="width: 200px; background: #e9ecef; border-radius: 10px; height: 20px;">
                                <div style="width: ${fitResult.fit_percentage}%; background: ${fitResult.fit_percentage >= 70 ? '#28a745' : fitResult.fit_percentage >= 50 ? '#ffc107' : '#dc3545'}; height: 100%; border-radius: 10px; transition: width 0.3s ease;"></div>
                            </div>
                        </div>
                        <p style="margin-bottom: 15px; line-height: 1.5;">${fitResult.summary}</p>
                    </div>
                `;

                if (fitResult.key_matches && fitResult.key_matches.length > 0) {
                    html += `
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #28a745; margin-bottom: 8px; display: block;">✓ Key Matches:</strong>
                            <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
                                ${fitResult.key_matches.map(match => `<li style="margin-bottom: 4px;">${match}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                }

                if (fitResult.key_gaps && fitResult.key_gaps.length > 0) {
                    html += `
                        <div>
                            <strong style="color: #dc3545; margin-bottom: 8px; display: block;">⚠ Key Gaps:</strong>
                            <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
                                ${fitResult.key_gaps.map(gap => `<li style="margin-bottom: 4px;">${gap}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                }

                fitContent.innerHTML = html;
            } else {
                fitContent.innerHTML = '<p style="color: #dc3545;">No candidate fit analysis available.</p>';
            }
        }
    }

    displayResults(data) {
        const resultsSection = document.getElementById('resultsSection');
        const dataPreview = document.getElementById('dataPreview');
        
        if (!resultsSection || !dataPreview) return;
        
        resultsSection.style.display = 'block';
        resultsSection.classList.add('fade-in');
        
        // Show a readable preview of each resume
        if (data && data.extracted_data && data.extracted_data.length > 0) {
            // Build a table preview with correct column order
            let table = `<div style="overflow-x: auto;">
                <table style="width:100%;border-collapse:collapse;margin-top:10px;">
                    <thead>
                        <tr style="background-color:#f5f5f5;">
                            <th style="border:1px solid #ddd;padding:8px;text-align:left;">#</th>
                            <th style="border:1px solid #ddd;padding:8px;text-align:left;">Name</th>
                            <th style="border:1px solid #ddd;padding:8px;text-align:left;">Email</th>
                            <th style="border:1px solid #ddd;padding:8px;text-align:left;">Phone</th>
                            <th style="border:1px solid #ddd;padding:8px;text-align:left;">Location</th>
                            <th style="border:1px solid #ddd;padding:8px;text-align:left;">Designation</th>
                            <th style="border:1px solid #ddd;padding:8px;text-align:left;">Skills</th>
                            <th style="border:1px solid #ddd;padding:8px;text-align:left;">Education</th>
                            <th style="border:1px solid #ddd;padding:8px;text-align:left;">Experience</th>
                        </tr>
                    </thead>
                    <tbody>`;
            
            data.extracted_data.forEach((resume, idx) => {
                const name = resume.personal_info?.name || '';
                const email = resume.personal_info?.email || '';
                const phone = resume.personal_info?.phone || '';
                const location = resume.personal_info?.location || '';
                const designation = resume.personal_info?.designation || '';
                
                const skills = Array.isArray(resume.skills) 
                    ? resume.skills.join(', ') 
                    : (resume.skills || '');
                
                const education = Array.isArray(resume.education)
                    ? resume.education.map(e => {
                        if (typeof e === 'object') {
                            return Object.values(e).filter(v => v).join(', ');
                        }
                        return e;
                    }).join(' | ')
                    : (resume.education || '');
                
                const experience = Array.isArray(resume.experience)
                    ? resume.experience.map(e => {
                        if (typeof e === 'object') {
                            return Object.values(e).filter(v => v).join(', ');
                        }
                        return e;
                    }).join(' | ')
                    : (resume.experience || '');
                
                table += `<tr>
                    <td style="border:1px solid #ddd;padding:8px;">${idx + 1}</td>
                    <td style="border:1px solid #ddd;padding:8px;">${name}</td>
                    <td style="border:1px solid #ddd;padding:8px;">${email}</td>
                    <td style="border:1px solid #ddd;padding:8px;">${phone}</td>
                    <td style="border:1px solid #ddd;padding:8px;">${location}</td>
                    <td style="border:1px solid #ddd;padding:8px;">${designation}</td>
                    <td style="border:1px solid #ddd;padding:8px;max-width:200px;word-wrap:break-word;">${skills}</td>
                    <td style="border:1px solid #ddd;padding:8px;max-width:200px;word-wrap:break-word;">${education}</td>
                    <td style="border:1px solid #ddd;padding:8px;max-width:200px;word-wrap:break-word;">${experience}</td>
                </tr>`;
            });
            table += '</tbody></table></div>';
            dataPreview.innerHTML = table;
        } else {
            dataPreview.innerHTML = '<em>No data extracted.</em>';
        }

        // Only fetch candidate fit if we have job description data
        if (this.jobDescriptionData) {
            this.fetchCandidateFit();
        }
    }

    async downloadData() {
        if (!this.extractedData) {
            this.showError('No data to download. Please extract data first.');
            return;
        }

        const format = 'xlsx';
        
        try {
            const response = await fetch('https://resume-info-extractor.up.railway.app/download-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    data: this.extractedData,
                    format: format
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the filename from the response headers
            const contentDisposition = response.headers.get('content-disposition');
            let filename = `resume_data.${format}`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }

            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error('Error downloading data:', error);
            this.showError('Failed to download data. Please try again.');
        }
    }

    // Add success message method
    showSuccess(message) {
        // Create success element if it doesn't exist
        let successMessage = document.getElementById('successMessage');
        if (!successMessage) {
            successMessage = document.createElement('div');
            successMessage.id = 'successMessage';
            successMessage.style.cssText = `
                display: none;
                margin: 10px 0;
                padding: 12px;
                background-color: #d4edda;
                border: 1px solid #c3e6cb;
                border-radius: 4px;
                color: #155724;
            `;
            // Insert after error message if it exists
            const errorMessage = document.getElementById('errorMessage');
            if (errorMessage) {
                errorMessage.parentNode.insertBefore(successMessage, errorMessage.nextSibling);
            } else {
                document.body.appendChild(successMessage);
            }
        }
        
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        
        // Auto-hide success after 3 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
    }

    showLoading() {
        const loading = document.getElementById('loading');
        const extractBtn = document.getElementById('extractBtn');
        const removeAllBtn = document.getElementById('removeAllBtn');
        
        if (loading) loading.style.display = 'block';
        if (extractBtn) extractBtn.style.display = 'none';
        if (removeAllBtn) removeAllBtn.disabled = true;
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        const extractBtn = document.getElementById('extractBtn');
        const removeAllBtn = document.getElementById('removeAllBtn');
        
        if (loading) loading.style.display = 'none';
        if (extractBtn) extractBtn.style.display = '';
        if (removeAllBtn) removeAllBtn.disabled = false;
    }

    showError(message) {
        const errorMessage = document.getElementById('errorMessage');
        if (!errorMessage) return;
        
        const errorText = errorMessage.querySelector('.error-text');
        if (errorText) {
            errorText.textContent = message;
        } else {
            errorMessage.textContent = message;
        }
        errorMessage.style.display = 'block';
        errorMessage.classList.add('fade-in');
        
        // Auto-hide error after 5 seconds
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    hideError() {
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.style.display = 'none';
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.resumeExtractor = new ResumeExtractor();
});
