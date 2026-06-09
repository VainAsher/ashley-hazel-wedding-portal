const buttons = document.querySelectorAll('[data-screen]');
const screens = document.querySelectorAll('.screen');
function showScreen(id){
  screens.forEach(s=>s.classList.toggle('active', s.id===id));
  document.querySelectorAll('.sidebar nav button').forEach(b=>b.classList.toggle('active', b.dataset.screen===id));
  window.scrollTo({top:0,behavior:'smooth'});
}
buttons.forEach(btn=>btn.addEventListener('click',()=>showScreen(btn.dataset.screen)));
