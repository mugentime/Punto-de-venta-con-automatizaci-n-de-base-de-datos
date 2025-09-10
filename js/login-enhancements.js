// Login Enhancements
document.addEventListener('DOMContentLoaded', () => {
    // Get form elements
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginTab = document.querySelector('[data-tab="login"]');
    const registerTab = document.querySelector('[data-tab="register"]');

    // Event listeners for tab switching
    document.querySelectorAll('.login-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active class from all tabs
            document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');

            // Show/hide forms based on selected tab
            if (tab.dataset.tab === 'login') {
                loginForm.style.display = 'block';
                registerForm.style.display = 'none';
            } else {
                loginForm.style.display = 'none';
                registerForm.style.display = 'block';
            }
        });
    });

    // Auto-fill button functionality
    const autoFillBtn = document.getElementById('auto-fill-btn');
    if (autoFillBtn) {
        autoFillBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const loginEmail = document.getElementById('login-email');
            const loginPassword = document.getElementById('login-password');
            if (loginEmail && loginPassword) {
                loginEmail.value = 'admin@conejonegro.com';
                loginPassword.value = 'admin123';
                
                // Show login form if not visible
                loginTab.click();
            }
        });
    }

    // Mobile enhancements
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android/.test(ua);
    
    if (isMobile) {
        // Improve input fields for mobile
        const emailInputs = document.querySelectorAll('input[type="email"]');
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        
        emailInputs.forEach(input => {
            input.setAttribute('inputmode', 'email');
            input.setAttribute('autocomplete', 'email');
        });
        
        passwordInputs.forEach(input => {
            input.setAttribute('autocomplete', 'current-password');
        });

        // Add touch-friendly classes
        document.querySelectorAll('.btn').forEach(btn => {
            btn.classList.add('touch-friendly');
        });
    }

    // Login form submit handler
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const submitButton = loginForm.querySelector('button[type="submit"]');
            
            try {
                // Disable button and show loading
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando sesión...';
                
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Store token
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    // Update connection status
                    document.querySelector('.status-dot').classList.remove('status-offline');
                    document.querySelector('.status-dot').classList.add('status-online');
                    document.querySelector('.connection-status span').textContent = 'Conectado';
                    
                    // Hide login screen, show main app
                    document.getElementById('login-screen').classList.add('hidden');
                    document.getElementById('main-app').style.display = 'block';
                    
                    // Update user info
                    document.getElementById('user-name').textContent = data.user.name || data.user.email;
                    document.getElementById('user-role').textContent = data.user.role;
                    document.getElementById('user-role').classList.add(data.user.role);
                } else {
                    throw new Error(data.error || 'Error de inicio de sesión');
                }
            } catch (error) {
                // Show error notification
                const notification = document.createElement('div');
                notification.className = 'notification notification-error';
                notification.textContent = error.message;
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    notification.classList.add('show');
                }, 100);
                
                setTimeout(() => {
                    notification.classList.remove('show');
                    setTimeout(() => notification.remove(), 300);
                }, 3000);
            } finally {
                // Re-enable button and restore text
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
            }
        });
    }
});
