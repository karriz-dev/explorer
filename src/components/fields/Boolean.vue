/*
 *
 * Copyright (c) 2019-present for NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License ");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

<template>
	<img
		v-if="isTrue"
		:title="value"
		:src="IconTrue"
		class="icon"
	/>
	<img
		v-else
		:title="value"
		:src="IconFalse"
		class="icon"
	/>
</template>
<script>
import IconTrue from '../../styles/img/checked_true.png';
import IconFalse from '../../styles/img/close_false.png';
export default {
	props: {
		value: [Boolean, String, Number]
	},

	data() {
		return {
			IconTrue,
			IconFalse
		};
	},

	computed: {
		isTrue() {
			const value = this.value;

			return value === true ||
                value === 1 ||
                value === 'true' ||
                value === '1' ||
                value === 'up' ||
                value === 'ok';
		}
	}
};
</script>

<style lang="scss" scoped>
.icon {
    height: 32px;
    width: 32px;
    filter: var(--icon-invert);
}
</style>
