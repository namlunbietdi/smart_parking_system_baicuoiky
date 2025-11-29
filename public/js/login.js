// public/js/login.js
// Client-side validation + gửi form đăng nhập tới backend (POST /api/auth/login).
// Ghi chú: fetch dùng credentials: 'include' để nhận cookie HttpOnly từ server.

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const email = document.getElementById("email");
    const pass = document.getElementById("password");
    const emailErr = document.getElementById("emailError");
    const passErr = document.getElementById("passwordError");
    const serverMsg = document.getElementById("serverMsg");
    const btn = document.getElementById("btnLogin");

    function clearErrors() {
        emailErr.textContent = "";
        passErr.textContent = "";
        serverMsg.textContent = "";
    }

    function validate() {
        clearErrors();
        let ok = true;

        const eVal = email.value.trim();
        const pVal = pass.value;

        if (!eVal || !/^\S+@\S+\.\S+$/.test(eVal)) {
            emailErr.textContent = "Nhập email hợp lệ";
            ok = false;
        }
        if (!pVal || pVal.length < 6) {
            passErr.textContent = "Mật khẩu >= 6 ký tự";
            ok = false;
        }
        return ok;
    }

    async function submitLogin(payload) {
        btn.disabled = true;
        btn.textContent = "Đang xử lý...";
        serverMsg.style.color = ""; serverMsg.textContent = "";

        try {
            const res = await fetch(form.action, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include", // rất quan trọng để nhận cookie HttpOnly
                body: JSON.stringify(payload)
            });

            // cố gắng parse JSON (nếu server trả JSON)
            let data = null;
            try { data = await res.json(); } catch (e) { /* ignore parse error */ }

            if (res.ok && data && data.ok) {
                serverMsg.style.color = "#0a8a0a";
                serverMsg.textContent = "Đăng nhập thành công. Chuyển hướng...";
                // redirect theo backend trả về hoặc mặc định /dashboard
                setTimeout(() => {
                    window.location.href = data.redirect || "/dashboard";
                }, 700);
                return;
            }

            // Nếu server trả lỗi (401...) hoặc data.ok=false
            if (data && data.message) {
                serverMsg.style.color = "#e64a4a";
                serverMsg.textContent = data.message;
            } else if (!res.ok) {
                serverMsg.style.color = "#e64a4a";
                serverMsg.textContent = `Lỗi server: ${res.status} ${res.statusText}`;
            } else {
                serverMsg.style.color = "#e64a4a";
                serverMsg.textContent = "Đăng nhập thất bại";
            }
        } catch (err) {
            console.error("Login error:", err);
            serverMsg.style.color = "#e64a4a";
            serverMsg.textContent = "Lỗi kết nối tới máy chủ";
        } finally {
            btn.disabled = false;
            btn.textContent = "Đăng nhập";
        }
    }

    form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        if (!validate()) return;
        const payload = {
            email: email.value.trim(),
            password: pass.value
        };
        submitLogin(payload);
    });

    // Optional: allow Enter on inputs to submit
    [email, pass].forEach(input => {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                form.requestSubmit();
            }
        });
    });
});