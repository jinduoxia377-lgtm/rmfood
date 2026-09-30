# 虚拟滚动列表使用示例


<!-- 使用虚拟滚动列表 -->
<virtual-list
  list="{{herbs}}"
  item-height="120"
  container-height="800"
  show-loading="{{loading}}"
  show-empty="{{!loading && herbs.length === 0}}"
  bind:reachend="onReachEnd"
  bind:itemtap="onItemTap"
>
  <view slot="item" class="herb-item">
    <text class="herb-name">{{item.name}}</text>
    <text class="herb-desc">{{item.description}}</text>
  </view>
</virtual-list>
