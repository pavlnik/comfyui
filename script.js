// Функция для обновления отступов карточек
function updateCardMargins() {
    // Определяем отступ в зависимости от ширины экрана
    const marginValue = window.innerWidth < 768 ? '1.25rem' : '1.5rem';
    
    document.querySelectorAll('.container > div').forEach(container => {
        const cards = container.querySelectorAll('.card');
        let lastVisibleIndex = -1;
        
        // Находим индекс последней видимой карточки
        cards.forEach((card, index) => {
            if (!card.classList.contains('hidden')) {
                lastVisibleIndex = index;
            }
        });
        
        // Устанавливаем отступы для всех карточек
        cards.forEach((card, index) => {
            if (index === lastVisibleIndex) {
                card.style.marginBottom = '0';
            } else if (!card.classList.contains('hidden')) {
                card.style.marginBottom = marginValue;
            } else {
                card.style.marginBottom = '0';
            }
        });
    });
}

// Вызываем функцию при загрузке и при изменении видимости элементов
document.addEventListener('DOMContentLoaded', updateCardMargins);

// Создаем наблюдатель за изменениями DOM
const observer = new MutationObserver(updateCardMargins);
observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
});

// Также вызываем функцию при изменении размера окна
window.addEventListener('resize', updateCardMargins);