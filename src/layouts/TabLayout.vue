<template>
  <div class="app-shell">
    <router-view v-slot="{ Component }">
      <keep-alive include="FileList,RecycleBin">
        <component :is="Component" />
      </keep-alive>
    </router-view>
    <van-tabbar route safe-area-inset-bottom placeholder fixed>
      <van-tabbar-item to="/files" icon="files-o">文件</van-tabbar-item>
      <van-tabbar-item to="/transfers" icon="exchange">传输</van-tabbar-item>
      <van-tabbar-item to="/recycle" icon="delete-o">回收站</van-tabbar-item>
      <van-tabbar-item to="/profile" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
</script>
