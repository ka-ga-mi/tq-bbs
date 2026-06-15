<template>
  <div class="route-loading" role="status" aria-label="页面加载中">
    <div class="route-loading__bar" />
  </div>
</template>

<style scoped>
.route-loading {
  position: fixed;
  inset: 0 0 auto;
  z-index: 9999;
  pointer-events: none;
}

.route-loading__bar {
  height: 2px;
  width: 36%;
  background: linear-gradient(90deg, transparent, var(--tq-danger), transparent);
  animation: route-loading-slide 0.9s ease-in-out infinite;
}

@keyframes route-loading-slide {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(320%);
  }
}
</style>
