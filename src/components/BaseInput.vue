
<script>
export default {
  name: "BaseInput",
  inheritAttrs: false,
  props: {
    name: String,
    label: String,
    modelValue: String,
    error: String,
  },
  emits: ["update:modelValue"],
};
</script>

<template>
  <div class="base-input" :data-invalid="!!error">
    <label class="base-input__label" for="">
      {{ label }}
    </label>
    <input
      v-bind="$attrs"
      type="text"
      :name="name"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <p class="base-input__error" v-if="error">
      {{ error }}
    </p>
  </div>
</template>

<style lang="scss">
.base-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;

  & + & {
    margin-top: 16px;
  }
}

.base-input__label {
  font-weight: 500;
}

.base-input__error {
  margin: 0;
  color: tomato;
}

.base-input[data-invalid="true"] {
  input {
    border: 1px solid tomato;

    &:focus {
      outline: 1px solid tomato;
    }
  }
}
</style>