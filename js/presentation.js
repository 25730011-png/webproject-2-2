/* Keyboard access for the existing card-based navigation. */
(function(){
  function decorate(){
    document.querySelectorAll('[data-go]').forEach(element=>{
      if(!['BUTTON','A'].includes(element.tagName)){
        element.setAttribute('role','button');element.setAttribute('tabindex','0');
      }
    });
  }
  document.addEventListener('keydown',event=>{
    if(!['Enter',' '].includes(event.key)||event.target.closest('input,textarea,select,button,a'))return;
    const element=event.target.closest('[data-go]');
    if(element){event.preventDefault();element.click();}
  });
  decorate();
  if(typeof MutationObserver!=='undefined')new MutationObserver(decorate).observe(document.querySelector('.app'),{childList:true,subtree:true});
})();
