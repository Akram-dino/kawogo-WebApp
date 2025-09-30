const showRegisterBtn = document.getElementById('showRegister');
const showLoginBtn = document.getElementById('showLogin');
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');

// Toggle between register and login forms
showRegisterBtn.addEventListener('click', () => {
    registerForm.style.display = 'flex';
    loginForm.style.display = 'none';
    showRegisterBtn.classList.add('active');
    showLoginBtn.classList.remove('active');
});

showLoginBtn.addEventListener('click', () => {
    registerForm.style.display = 'none';
    loginForm.style.display = 'flex';
    showRegisterBtn.classList.remove('active');
    showLoginBtn.classList.add('active');
});
